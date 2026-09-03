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
 *   - 比對路徑：SLS_Item.piId ←→ PO.slsPiId（同一 PI = 同一交易）
 *     裝箱單品項帶著「屬於哪張 PI（piId）」，採購單帶著「為哪張 PI 而開（slsPiId）」。
 *     兩者 piId 相同 → ft³ 歸屬此供應商。同一 PI 若多家拆單，再依 PO_Item.quantity 比例拆分。
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

export async function POST(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = Number(params.id)
  if (isNaN(shipmentId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const { suppliers, costItems, usedCbmFallback } = await computeAllocation(prisma, shipmentId)

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
  // 正確路徑：SLS_Item.piId ←→ PO.slsPiId
  //   裝箱單品項帶著「屬於哪張 PI（piId）」，採購單也帶著「為哪張 PI 而開（slsPiId）」。
  //   兩者 piId 相同 → 這筆 ft³ 就屬於這張採購單的供應商。
  //   同一 PI 若被多家供應商拆單（同 piId 多張 PO），再用 PO_Item.quantity 按比例拆分。
  //   不再用 productId/rawSku 跨 PI 比對——那樣會把所有有同產品的廠商全部拉進來，造成嚴重重複計算。

  const slsItems = await prisma.sLS_Item.findMany({
    where: { shipmentId },
    select: {
      rawSku: true,
      cubicFt: true,
      cbm: true,
      piId: true,
      slsItemId: true,
      slsItem: { select: { productId: true } },
    },
  })

  // 取得各 PO 的 slsPiId（PI 連結）與 PO_Item（含 productId + quantity）
  const poIds = payables.map(p => p.poId).filter(Boolean) as number[]
  const poItems = poIds.length > 0
    ? await prisma.pO_Item.findMany({
        where: { orderId: { in: poIds } },
        select: {
          orderId: true,
          productId: true,
          quantity: true,
          order: { select: { slsPiId: true } },
        },
      })
    : []

  // 建立三層查找表
  //   (piId, productId) → [{poId, qty}]  最精確：同一 PI 同一產品
  //   piId              → [{poId, qty}]  fallback：同一 PI（產品未能比對時）
  const piProductPoMap = new Map<string, { poId: number; qty: number }[]>()
  const piPoMap = new Map<number, { poId: number; qty: number }[]>()

  for (const item of poItems) {
    const piId = item.order?.slsPiId ?? null
    if (!piId) continue

    const piArr = piPoMap.get(piId) ?? []
    piArr.push({ poId: item.orderId, qty: item.quantity })
    piPoMap.set(piId, piArr)

    const key = `${piId}:${item.productId}`
    const ppArr = piProductPoMap.get(key) ?? []
    ppArr.push({ poId: item.orderId, qty: item.quantity })
    piProductPoMap.set(key, ppArr)
  }

  // 按比例分配 ft³：單一 PO 直接全給；多 PO 依數量加權
  function distributeToPos(
    ft: number,
    pos: { poId: number; qty: number }[],
    map: Map<number, number>,
  ) {
    if (ft === 0 || pos.length === 0) return
    if (pos.length === 1) {
      map.set(pos[0].poId, (map.get(pos[0].poId) ?? 0) + ft)
      return
    }
    const totalQty = pos.reduce((s, p) => s + p.qty, 0)
    for (const { poId, qty } of pos) {
      const share = totalQty > 0 ? ft * qty / totalQty : ft / pos.length
      map.set(poId, (map.get(poId) ?? 0) + share)
    }
  }

  // 逐筆裝箱單品項 → 找到對應的 PO → 累計 ft³
  const poCubicFtMap = new Map<number, number>()

  for (const item of slsItems) {
    const ft = item.cubicFt
      ? Number(item.cubicFt)
      : item.cbm ? Number(item.cbm) * 35.3147 : 0
    if (ft === 0) continue

    // 路徑 1（最精確）：piId + productId → 同一 PI 同一產品的採購單
    if (item.piId && item.slsItem?.productId) {
      const pos = piProductPoMap.get(`${item.piId}:${item.slsItem.productId}`)
      if (pos?.length) { distributeToPos(ft, pos, poCubicFtMap); continue }
    }

    // 路徑 2（fallback）：piId → 該 PI 對應的所有採購單，依數量比例拆分
    if (item.piId) {
      const pos = piPoMap.get(item.piId)
      if (pos?.length) { distributeToPos(ft, pos, poCubicFtMap); continue }
    }

    // 路徑 3（最後手段）：piId 為 null 的品項，暫不計入分攤（無法追溯供應商）
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
