/**
 * FOB 費用分攤 API
 *
 * GET  /api/shipments/[id]/fob-allocation
 *   計算並預覽本次出貨的 FOB 費用分攤結果（不寫入 DB）
 *   回傳：各供應商的材積（ft³）、佔比、各費用項目的應扣金額、是否 FOB
 *
 * POST /api/shipments/[id]/fob-allocation
 *   確認並套用分攤結果：
 *   1. 清除舊有 SLS_FobCostAllocation（同 shipmentId）
 *   2. 新建 SLS_FobCostAllocation 明細
 *   3. 更新 FIN_Payable.fobCostDeductionTWD（本次分攤總和）
 *
 * 演算法（材積比例）：
 *   - 從 FIN_Payable 取得此出貨的所有 PO（含供應商）
 *   - 判斷每張 PO 的交易條件：PO.tradeTerms ?? SUP_Supplier.defaultTradeTerms
 *   - 分母 = 全部出貨供應商材積（FOB + FOR），代表這批出貨的 100%
 *   - FOB 供應商的比例 = 自身材積 / 全部出貨材積（FOR 那份由我們承擔，不向 FOR 收取）
 *   - 材積來源：SLS_Item.cubicFt（ft³，Patisco 原始值）
 *   - 比對路徑（正確）：PO_ShippingNotice（出貨通知單）
 *     每張通知單對應一家供應商，品項列出該供應商要出的產品（productId）。
 *     用 productId 比對 SLS_Item（裝箱單），加總 ft³ 就是該供應商的採計材積。
 *     比對不到 productId 時，fallback 用 rawSku 比對通知單品項的 product.sku。
 *   - 若 FOB 供應商完全無材積資料，改以各 PO amountTWD 比例分攤
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { Decimal } from '@prisma/client/runtime/library'

type Params = { params: { id: string } }

// ─── 輔助型別 ────────────────────────────────────────────────────────────────

interface SupplierInfo {
  supplierId: number
  supplierName: string
  poId: number | null
  poNo: string | null
  tradeTerms: string | null
  amountTWD: number
  cubicFt: number          // 採計材積（ft³）
  cbmPct: number           // 佔全部出貨材積的 %（分母含 FOR）
  isFob: boolean
  allocations: {
    costItemId: number
    costItemName: string
    allocatedTWD: number
  }[]
  totalDeductionTWD: number
}

function isFobTerms(terms: string | null | undefined): boolean {
  if (!terms) return false
  const t = terms.toUpperCase().trim()
  return t.startsWith('FOB') || t === 'FCA' || t === 'FAS'
}

// ─── GET：預覽計算結果 ────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = Number(params.id)
  if (isNaN(shipmentId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const result = await computeAllocation(prisma, shipmentId)
  return NextResponse.json(result)
}

// ─── POST：確認套用 ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = Number(params.id)
  if (isNaN(shipmentId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  // 可選：前端手動調整的材積覆蓋值（supplierId → ft³）
  const body = await req.json().catch(() => ({}))
  const cubicFtOverrides: Record<number, number> | undefined = body.overrides
    ? Object.fromEntries(
        Object.entries(body.overrides as Record<string, unknown>)
          .map(([k, v]) => [Number(k), Number(v)])
          .filter(([, v]) => !isNaN(v as number)),
      )
    : undefined

  const { suppliers, costItems, usedCbmFallback } = await computeAllocation(prisma, shipmentId, cubicFtOverrides)

  if (costItems.length === 0) {
    return NextResponse.json({ error: '尚無貨代費用項目，請先上傳報關發票。' }, { status: 400 })
  }

  const fobSuppliers = suppliers.filter(s => s.isFob)
  if (fobSuppliers.length === 0) {
    return NextResponse.json({ error: '本次出貨無 FOB 供應商，無需分攤。' }, { status: 400 })
  }

  await prisma.$transaction(async tx => {
    // 1. 清除此出貨的所有舊分攤記錄
    const existingItems = await tx.sLS_FobCostItem.findMany({
      where: { shipmentId },
      select: { id: true },
    })
    const itemIds = existingItems.map(i => i.id)
    if (itemIds.length > 0) {
      await tx.sLS_FobCostAllocation.deleteMany({ where: { costItemId: { in: itemIds } } })
    }

    // 2. 新建分攤記錄
    for (const sup of fobSuppliers) {
      for (const alloc of sup.allocations) {
        await tx.sLS_FobCostAllocation.create({
          data: {
            costItemId:   alloc.costItemId,
            supplierId:   sup.supplierId,
            poId:         sup.poId,
            cubicFt:      new Decimal(sup.cubicFt.toFixed(4)),
            cbmPct:       new Decimal(sup.cbmPct.toFixed(4)),
            allocatedTWD: new Decimal(alloc.allocatedTWD.toFixed(0)),
            applied:      true,
            payableId: sup.poId
              ? (await tx.fIN_Payable.findUnique({
                  where: { shipmentId_poId: { shipmentId, poId: sup.poId } },
                  select: { id: true },
                }))?.id ?? null
              : null,
          },
        })
      }

      // 3. 更新 FIN_Payable.fobCostDeductionTWD
      if (sup.poId) {
        await tx.fIN_Payable.updateMany({
          where: { shipmentId, poId: sup.poId },
          data: { fobCostDeductionTWD: new Decimal(sup.totalDeductionTWD.toFixed(0)) },
        })
      }
    }

    // 重置所有 FOR 供應商的扣款為 0（避免重算後殘留舊值）
    const forSuppliers = suppliers.filter(s => !s.isFob && s.poId)
    for (const sup of forSuppliers) {
      await tx.fIN_Payable.updateMany({
        where: { shipmentId, poId: sup.poId! },
        data: { fobCostDeductionTWD: new Decimal(0) },
      })
    }
  })

  const updatedResult = await computeAllocation(prisma, shipmentId)
  return NextResponse.json({ ok: true, ...updatedResult })
}

// ─── 核心計算邏輯 ─────────────────────────────────────────────────────────────

async function computeAllocation(
  prisma: Awaited<ReturnType<typeof getRequestPrisma>>,
  shipmentId: number,
  cubicFtOverrides?: Record<number, number>,
) {
  // 取得費用項目
  const costItems = await prisma.sLS_FobCostItem.findMany({
    where: { shipmentId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, amountTWD: true },
  })

  // 取得此出貨的所有 payable（含 PO 與供應商資料）
  const payables = await prisma.fIN_Payable.findMany({
    where: { shipmentId },
    select: {
      id: true,
      supplierId: true,
      poId: true,
      amountTWD: true,
      fobCostDeductionTWD: true,
      supplier: { select: { id: true, name: true, defaultTradeTerms: true } },
      po: { select: { id: true, poNo: true, tradeTerms: true } },
    },
  })

  // ── 材積資料抓取（ft³）────────────────────────────────────────────────────
  //
  // 資料來源：出貨通知單（PO_ShippingNotice）
  //   完全複製 /api/print/shipping-notice/[id] 的 filter 邏輯：
  //     noticeSkus = notice.items.map(it => it.product.sku)
  //     filter SLS_Item：rawSku ?? slsItem.product.sku ∈ noticeSkus
  //     totalFt = sum(matched SLS_Items.cubicFt)
  //   這個 totalFt 就是印刷路由在頁尾顯示的「本次出貨總材積」，是唯一可信的來源。

  // Step 1: 此出貨的所有出貨通知單（一家供應商一張）
  const shippingNotices = await prisma.pO_ShippingNotice.findMany({
    where: { sourceShipmentId: shipmentId },
    select: {
      supplierId: true,
      items: {
        select: {
          poId: true,
          notifiedQuantity: true,
          product: { select: { sku: true } },
        },
      },
    },
  })

  // Step 2: 裝箱單所有品項（含 sku fallback 路徑、箱號欄位）
  //   cubicFt 是每箱值，必須乘以箱數（boxCount）才是正確總材積
  const slsItems = await prisma.sLS_Item.findMany({
    where: { shipmentId },
    select: {
      rawSku: true,
      cubicFt: true,
      cbm: true,
      cartons: true,
      cartonNoFrom: true,
      cartonNoTo: true,
      pi: { select: { piNo: true } },
      slsItem: { select: { product: { select: { sku: true } } } },
    },
    orderBy: [{ piId: 'asc' }, { id: 'asc' }],
  })

  // 與 /print/sn 的 boxCount() 完全相同
  function boxCount(from: string | null, to: string | null, cartons: number | null): number {
    const f = parseInt(from ?? '0') || 0
    const t = parseInt(to ?? from ?? '0') || f
    return f > 0 ? Math.max(1, t - f + 1) : (cartons ?? 1)
  }

  // Step 3: 逐家供應商 → 複製 print route 的 filter + 去重邏輯 → 算出 totalFt
  //   同一供應商若有多張 PO，依各 PO notifiedQuantity 比例拆分。
  const poCubicFtMap = new Map<number, number>()

  for (const notice of shippingNotices) {
    const noticeSkus = new Set<string>(
      notice.items.map(it => it.product.sku).filter((s): s is string => !!s),
    )
    if (noticeSkus.size === 0) continue

    const filtered = slsItems.filter(it => {
      const sku = it.rawSku ?? it.slsItem?.product?.sku
      return sku != null && noticeSkus.has(sku)
    })

    // 總材積：依 piNo:cartonNoFrom 去重（同 print route 邏輯），每箱 cubicFt × 箱數
    let totalFt = 0
    const seen = new Set<string>()
    filtered.forEach((it, idx) => {
      const key = `${it.pi?.piNo ?? ''}:${it.cartonNoFrom ?? `__null_${idx}`}`
      if (seen.has(key)) return
      seen.add(key)
      const boxes = boxCount(it.cartonNoFrom, it.cartonNoTo, it.cartons)
      totalFt += it.cubicFt ? Number(it.cubicFt) * boxes : it.cbm ? Number(it.cbm) * 35.3147 * boxes : 0
    })

    if (totalFt === 0) continue

    // 按此供應商各 PO 的 notifiedQuantity 比例拆分 totalFt
    const poQtyMap = new Map<number, number>()
    for (const it of notice.items) {
      if (it.product.sku && noticeSkus.has(it.product.sku)) {
        poQtyMap.set(it.poId, (poQtyMap.get(it.poId) ?? 0) + it.notifiedQuantity)
      }
    }
    const totalQty = Array.from(poQtyMap.values()).reduce((s, q) => s + q, 0)
    poQtyMap.forEach((qty, poId) => {
      const share = totalQty > 0 ? totalFt * qty / totalQty : totalFt
      poCubicFtMap.set(poId, (poCubicFtMap.get(poId) ?? 0) + share)
    })
  }

  // ── 計算各 payable（供應商）的有效條款與採計材積 ─────────────────────────

  const supplierInfos: SupplierInfo[] = payables.map(p => {
    const effectiveTerms = p.po?.tradeTerms ?? p.supplier.defaultTradeTerms
    const isFob = isFobTerms(effectiveTerms)
    const cubicFt = p.poId ? (poCubicFtMap.get(p.poId) ?? 0) : 0

    return {
      supplierId:        p.supplier.id,
      supplierName:      p.supplier.name,
      poId:              p.poId,
      poNo:              p.po?.poNo ?? null,
      tradeTerms:        effectiveTerms ?? null,
      amountTWD:         Number(p.amountTWD),
      cubicFt,
      cbmPct:            0,
      isFob,
      allocations:       [],
      totalDeductionTWD: 0,
    }
  })

  // ── 套用手動覆蓋（供應商層級 → 按原始各 PO 比例分配）─────────────────────

  if (cubicFtOverrides && Object.keys(cubicFtOverrides).length > 0) {
    // 先算出每家供應商的原始總材積（跨多張 PO 加總）
    const origBySupp = new Map<number, number>()
    for (const s of supplierInfos) {
      origBySupp.set(s.supplierId, (origBySupp.get(s.supplierId) ?? 0) + s.cubicFt)
    }
    for (const s of supplierInfos) {
      const override = cubicFtOverrides[s.supplierId]
      if (override == null) continue
      const origTotal = origBySupp.get(s.supplierId) ?? 0
      if (origTotal > 0) {
        s.cubicFt = override * (s.cubicFt / origTotal)
      } else {
        const count = supplierInfos.filter(x => x.supplierId === s.supplierId).length
        s.cubicFt = override / count
      }
    }
  }

  // ── 計算佔比（分母 = 全部供應商材積，含 FOR）─────────────────────────────

  const fobSuppliers = supplierInfos.filter(s => s.isFob)
  const totalFobCubicFt = fobSuppliers.reduce((sum, s) => sum + s.cubicFt, 0)
  const totalAllCubicFt = supplierInfos.reduce((sum, s) => sum + s.cubicFt, 0)
  const totalAllAmount  = supplierInfos.reduce((sum, s) => sum + s.amountTWD, 0)

  let usedCbmFallback = false

  if (totalFobCubicFt === 0 && fobSuppliers.length > 0) {
    // Fallback：FOB 供應商全無材積，改以金額比例分攤
    usedCbmFallback = true
    for (const sup of supplierInfos) {
      sup.cbmPct = totalAllAmount > 0 ? (sup.amountTWD / totalAllAmount) * 100 : 0
    }
  } else {
    // 正常路徑：以全部出貨總材積為分母，全部供應商都算出參考佔比
    for (const sup of supplierInfos) {
      sup.cbmPct = totalAllCubicFt > 0 ? (sup.cubicFt / totalAllCubicFt) * 100 : 0
    }
  }

  // ── 計算各費用項目對各 FOB 供應商的分攤金額 ──────────────────────────────

  const totalCostTWD = costItems.reduce((sum, i) => sum + Number(i.amountTWD), 0)
  for (const sup of fobSuppliers) {
    sup.allocations = costItems.map(item => ({
      costItemId:   item.id,
      costItemName: item.name,
      allocatedTWD: Math.round(Number(item.amountTWD) * sup.cbmPct / 100),
    }))
    sup.totalDeductionTWD = sup.allocations.reduce((sum, a) => sum + a.allocatedTWD, 0)
  }

  return {
    suppliers:        supplierInfos,
    costItems:        costItems.map(i => ({ id: i.id, name: i.name, amountTWD: Number(i.amountTWD) })),
    totalCostTWD,
    totalFobCubicFt,
    totalAllCubicFt,
    usedCbmFallback,
  }
}
