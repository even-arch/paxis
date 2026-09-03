/**
 * FOB 費用分攤 API
 *
 * GET  /api/shipments/[id]/fob-allocation
 *   計算並預覽本次出貨的 FOB 費用分攤結果（不寫入 DB）
 *   回傳：各供應商的材積、百分比、各費用項目的應扣金額、是否 FOB
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
 *   - 每家 FOB 供應商的比例 = 自身材積 / 全部出貨材積（FOR 那份由我們承擔，不向 FOR 收取）
 *   - 材積來源：SLS_Item.cbm，以 rawSku 對應到各 PO 的 PO_Item.product.sku
 *   - 若 FOB 供應商完全無 CBM 資料，改以各 PO amountTWD 比例分攤（fallback，分母亦為全部供應商）
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
  tradeTerms: string | null   // 最終有效條款（PO 覆蓋 → 供應商預設）
  amountTWD: number           // FIN_Payable.amountTWD（作為 fallback 基準）
  cbm: number                 // 匹配到的材積
  cbmPct: number              // 佔全部出貨材積的 %（FOR 供應商此欄為 0；分母含 FOR）
  isFob: boolean
  allocations: {              // 每筆費用分攤明細
    costItemId: number
    costItemName: string
    allocatedTWD: number
  }[]
  totalDeductionTWD: number   // 此供應商全部費用加總
}

// 判斷是否為 FOB（含 FOB 及其衍生條款）
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
            cbm:          new Decimal(sup.cbm.toFixed(6)),
            cbmPct:       new Decimal(sup.cbmPct.toFixed(4)),
            allocatedTWD: new Decimal(alloc.allocatedTWD.toFixed(0)),
            applied:      true,
            // 找對應的 FIN_Payable
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

  // 取得此出貨的 SLS_Item（材積資料）
  const slsItems = await prisma.sLS_Item.findMany({
    where: { shipmentId },
    select: { rawSku: true, cbm: true, cubicFt: true, quantity: true },
  })

  // 建立 SKU → 材積 map（rawSku → 各 SLS_Item 的 cbm 合計）
  const skuCbmMap = new Map<string, number>()
  for (const item of slsItems) {
    if (!item.rawSku) continue
    const cbmValue = item.cbm
      ? Number(item.cbm)
      : item.cubicFt
        ? Number(item.cubicFt) * 0.028317
        : 0
    skuCbmMap.set(item.rawSku, (skuCbmMap.get(item.rawSku) ?? 0) + cbmValue)
  }

  // 為每張 PO 拉取品項的 product.sku
  const poProductSkus = new Map<number, { sku: string; quantity: number }[]>()
  if (payables.some(p => p.poId)) {
    const poIds = payables.map(p => p.poId).filter(Boolean) as number[]
    const poItems = await prisma.pO_Item.findMany({
      where: { orderId: { in: poIds } },
      select: { orderId: true, quantity: true, product: { select: { sku: true } } },
    })
    for (const item of poItems) {
      if (!item.product.sku) continue
      const existing = poProductSkus.get(item.orderId) ?? []
      existing.push({ sku: item.product.sku, quantity: item.quantity })
      poProductSkus.set(item.orderId, existing)
    }
  }

  // 計算每個 payable（供應商在本次出貨）的有效交易條款與材積
  const supplierInfos: SupplierInfo[] = payables.map(p => {
    const effectiveTerms = p.po?.tradeTerms ?? p.supplier.defaultTradeTerms
    const isFob = isFobTerms(effectiveTerms)

    // 計算此供應商在本次出貨的 CBM
    let cbm = 0
    if (p.poId) {
      const skusForPo = poProductSkus.get(p.poId) ?? []
      for (const { sku } of skusForPo) {
        cbm += skuCbmMap.get(sku) ?? 0
      }
    }

    return {
      supplierId:        p.supplier.id,
      supplierName:      p.supplier.name,
      poId:              p.poId,
      poNo:              p.po?.poNo ?? null,
      tradeTerms:        effectiveTerms ?? null,
      amountTWD:         Number(p.amountTWD),
      cbm,
      cbmPct:            0,    // 後面計算
      isFob,
      allocations:       [],   // 後面計算
      totalDeductionTWD: 0,    // 後面計算
    }
  })

  // 計算 CBM 比例
  // 分母 = 全部出貨供應商材積（含 FOR），FOB 只收自己那一份；FOR 那份由我們承擔
  const fobSuppliers = supplierInfos.filter(s => s.isFob)
  const totalFobCbm = fobSuppliers.reduce((sum, s) => sum + s.cbm, 0)
  const totalAllCbm = supplierInfos.reduce((sum, s) => sum + s.cbm, 0)   // 分母
  const totalAllAmount = supplierInfos.reduce((sum, s) => sum + s.amountTWD, 0) // fallback 分母

  // fallback：若 FOB 供應商全無 CBM 資料，改以金額比例分攤
  let usedCbmFallback = false
  if (totalFobCbm === 0 && fobSuppliers.length > 0) {
    usedCbmFallback = true
    // fallback 亦以全部供應商金額為分母，FOB 只收自己那份
    for (const sup of fobSuppliers) {
      sup.cbmPct = totalAllAmount > 0 ? (sup.amountTWD / totalAllAmount) * 100 : 0
    }
    // FOR 供應商亦以金額比例顯示（參考用，不扣款）
    for (const sup of supplierInfos.filter(s => !s.isFob)) {
      sup.cbmPct = totalAllAmount > 0 ? (sup.amountTWD / totalAllAmount) * 100 : 0
    }
  } else {
    // 正常路徑：以全部出貨總材積為分母，全部供應商都算出參考佔比
    for (const sup of supplierInfos) {
      sup.cbmPct = totalAllCbm > 0 ? (sup.cbm / totalAllCbm) * 100 : 0
    }
  }

  // 計算各費用項目對各 FOB 供應商的分攤金額
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
    suppliers:       supplierInfos,
    costItems:       costItems.map(i => ({ id: i.id, name: i.name, amountTWD: Number(i.amountTWD) })),
    totalCostTWD,
    totalFobCbm,
    totalAllCbm,
    usedCbmFallback,
  }
}
