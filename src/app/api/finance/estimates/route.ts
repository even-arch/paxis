import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function GET() {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 預載所有 PO（含品項金額與 SKU）— 用於 slsPiId / poNo / salesOrderId 配對
  const allPOs = await prisma.pO.findMany({
    select: {
      id: true,
      poNo: true,
      totalAmount: true,
      currencyCode: true,
      exchangeRate: true,
      slsPiId: true,
      salesOrderId: true,
      supplier: { select: { id: true, name: true, shortName: true } },
      items: {
        select: {
          unitPrice: true,
          quantity: true,
          product: { select: { sku: true } },
        },
      },
    },
  })
  // SKU → TWD 進價 map：piId → { sku → unitPrice }
  // 用於品項級別比對：用本次出貨 SKU 找對應進價，計算實際出貨成本
  const costBySku = new Map<number, Map<string, number>>() // piId → sku → unitPriceTWD
  for (const po of allPOs) {
    if (!po.slsPiId) continue
    const skuMap = costBySku.get(po.slsPiId) ?? new Map<string, number>()
    for (const item of po.items) {
      if (item.product?.sku && item.unitPrice) {
        skuMap.set(item.product.sku, Number(item.unitPrice))
      }
    }
    costBySku.set(po.slsPiId, skuMap)
  }

  function extractDocNo(str: string): string {
    const m = str.match(/\b([A-Z]{1,3}\d{5,})\b/)
    if (m) return m[1]
    return str.split(' ')[0]
  }

  // 建立三個查詢 map：slsPiId → PO（主）、salesOrderId → PO（次）、poNo → PO（備援）
  const poByPiId = new Map<number, typeof allPOs[0]>()
  const poBySlsId = new Map<number, typeof allPOs>()
  const poByPoNo = new Map<string, typeof allPOs[0]>()
  for (const po of allPOs) {
    if (po.slsPiId) poByPiId.set(po.slsPiId, po)
    if (po.salesOrderId) {
      const arr = poBySlsId.get(po.salesOrderId) ?? []
      arr.push(po)
      poBySlsId.set(po.salesOrderId, arr)
    }
    poByPoNo.set(po.poNo, po)
    const docNo = extractDocNo(po.poNo)
    if (docNo !== po.poNo) poByPoNo.set(docNo, po)
  }

  function poAmountTWD(po: typeof allPOs[0]): number {
    // 優先用 totalAmount，否則從品項加總
    const base = po.totalAmount
      ? Number(po.totalAmount)
      : po.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0)
    return base * Number(po.exchangeRate ?? 1)
  }

  const shipments = await prisma.sLS.findMany({
    orderBy: { actualShipDate: 'desc' },
    include: {
      customer: { select: { id: true, name: true, shortName: true } },
      items: {
        select: {
          piId: true,
          quantity: true,
          rawSku: true,
          unitPrice: true,
        },
      },
      receivable: {
        select: {
          amountForeign: true,
          currencyCode: true,
          rateAtInvoice: true,
          amountTWD: true,
          collectedForeign: true,
          rateAtCollection: true,
          collectedTWD: true,
          fxGainLoss: true,
          status: true,
        },
      },
      pis: {
        include: {
          pi: {
            select: {
              id: true,
              piNo: true,
              orderId: true,
              totalAmount: true,
              currencyCode: true,
              extraCharges: true,
              order: {
                select: {
                  id: true,
                  orderNo: true,
                  totalAmount: true,
                  currencyCode: true,
                  exchangeRate: true,
                },
              },
            },
          },
        },
      },
    },
  })

  // extraCharges JSON 類型：
  //   type "0" / "2" = 百分比（amount = 5 → +5%）
  //   type "1"       = 固定金額（amount = 4756 → +4756 TWD）
  // 回傳 { pctMultiplier, flatTWD }
  function calcExtraCharges(extraCharges: unknown): { pctMultiplier: number; flatTWD: number } {
    if (!extraCharges || !Array.isArray(extraCharges)) return { pctMultiplier: 1, flatTWD: 0 }
    let pct = 0, flat = 0
    for (const c of extraCharges as { type?: string; amount?: string }[]) {
      if (!c.amount) continue
      if (c.type === '1') flat += Number(c.amount)
      else pct += Number(c.amount)  // type "0" / "2" = 百分比
    }
    return { pctMultiplier: 1 + pct / 100, flatTWD: flat }
  }

  const rows = shipments.map(s => {
    // ── AR ────────────────────────────────────────────────────────────────
    // ciExchangeRate 是 TWD→EUR 的方向（例如 0.0278 = 1 TWD = 0.0278 EUR）
    // PO_CustomerCopy.totalAmount 是台幣金額，不需再乘匯率
    let arTWD = 0
    let arForeign = 0  // EUR 顯示用
    let arCurrency = 'EUR'
    let arFromRecord = false

    const ciRate = Number(s.ciExchangeRate ?? 0)  // TWD → EUR

    if (s.receivable && s.receivable.currencyCode !== 'TWD') {
      // 正確格式的 EUR 記錄（新版 backfill 建的）：amountForeign=EUR, rateAtInvoice=EUR→TWD
      arForeign = Number(s.receivable.amountForeign)
      arTWD = Number(s.receivable.amountTWD)
      arCurrency = 'EUR'
      arFromRecord = true
    } else {
      // 從 PI → Order 計算，加上 PI 層級的 extraCharges（百分比 + 固定金額）
      arTWD = s.pis.reduce((sum, sp) => {
        // PI 是主，PO_CustomerCopy 只做 fallback
        const totalAmt = sp.pi.totalAmount ?? sp.pi.order?.totalAmount
        const currCode = sp.pi.currencyCode ?? sp.pi.order?.currencyCode ?? 'TWD'
        if (!totalAmt) return sum
        const base = currCode === 'TWD'
          ? Number(totalAmt)
          : (ciRate > 0 ? Number(totalAmt) / ciRate : Number(totalAmt) * Number(sp.pi.order?.exchangeRate ?? 1))
        const { pctMultiplier, flatTWD } = calcExtraCharges(sp.pi.extraCharges)
        return sum + base * pctMultiplier + flatTWD
      }, 0)
      arForeign = ciRate > 0 ? arTWD * ciRate : 0
    }

    // ── AP：三層 fallback ──────────────────────────────────────────────────
    // 主路徑A：PO.slsPiId = PI.id（正式 FK，貿易商模式核心連結）
    // 主路徑B：PO.poNo = PI.piNo（號碼一致時的 fallback）
    // 次路徑：PO.salesOrderId = PO_CustomerCopy.id（有 PO_CustomerCopy 連結時補充）
    const poMap = new Map<number, { poNo: string; supplierName: string; amountTWD: number; currency: string; matchType: string }>()

    for (const sp of s.pis) {
      // 主路徑A：slsPiId 直連
      const byPiId = poByPiId.get(sp.pi.id)
      if (byPiId && !poMap.has(byPiId.id)) {
        poMap.set(byPiId.id, {
          poNo: byPiId.poNo,
          supplierName: byPiId.supplier.shortName ?? byPiId.supplier.name,
          amountTWD: poAmountTWD(byPiId),
          currency: byPiId.currencyCode,
          matchType: 'bySlsPiId',
        })
        continue
      }

      // 主路徑B：piNo = poNo
      const piDocNo = extractDocNo(sp.pi.piNo)
      const byPiNo = poByPoNo.get(sp.pi.piNo) ?? poByPoNo.get(piDocNo)
      if (byPiNo && !poMap.has(byPiNo.id)) {
        poMap.set(byPiNo.id, {
          poNo: byPiNo.poNo,
          supplierName: byPiNo.supplier.shortName ?? byPiNo.supplier.name,
          amountTWD: poAmountTWD(byPiNo),
          currency: byPiNo.currencyCode,
          matchType: 'byPiNo',
        })
        continue
      }

      // 次路徑：salesOrderId（有關聯 PO_CustomerCopy 時）
      const slsOrder = sp.pi.order
      if (slsOrder) {
        const bySlsId = poBySlsId.get(slsOrder.id) ?? []
        for (const po of bySlsId) {
          if (poMap.has(po.id)) continue
          poMap.set(po.id, {
            poNo: po.poNo,
            supplierName: po.supplier.shortName ?? po.supplier.name,
            amountTWD: poAmountTWD(po),
            currency: po.currencyCode,
            matchType: 'bySalesOrderId',
          })
        }
        if (bySlsId.length === 0) {
          const po = poByPoNo.get(slsOrder.orderNo) ?? poByPoNo.get(extractDocNo(slsOrder.orderNo))
          if (po && !poMap.has(po.id)) {
            poMap.set(po.id, {
              poNo: po.poNo,
              supplierName: po.supplier.shortName ?? po.supplier.name,
              amountTWD: poAmountTWD(po),
              currency: po.currencyCode,
              matchType: 'byOrderNo',
            })
          }
        }
      }
    }

    // ── 品項級別 AP 計算（主路徑）─────────────────────────────────────────
    // 用本次出貨 SLS_Item（SKU + 數量）× 對應 PO 進價（TWD），只算實際出貨部分
    let apFromItems = 0
    let itemsMatchedCount = 0
    for (const item of s.items) {
      if (!item.piId || !item.rawSku) continue
      const skuMap = costBySku.get(item.piId)
      const costPrice = skuMap?.get(item.rawSku)
      if (costPrice != null) {
        apFromItems += item.quantity * costPrice
        itemsMatchedCount++
      }
    }
    const totalItems = s.items.filter(i => i.piId && i.rawSku).length
    const useItemLevel = itemsMatchedCount > 0 && itemsMatchedCount >= totalItems * 0.5

    const apItems = Array.from(poMap.values())
    // 主路徑：品項比對（覆蓋率 >= 50%）；否則 fallback 到整張 PO 金額
    const apTWD = useItemLevel ? apFromItems : apItems.reduce((sum, p) => sum + p.amountTWD, 0)
    const apMatchType = useItemLevel ? `item-level (${itemsMatchedCount}/${totalItems})` : 'po-total'
    const grossTWD = arTWD - apTWD
    const grossPct = arTWD > 0 ? (grossTWD / arTWD) * 100 : null

    // 診斷：找出沒配到 PO 的 order，以及配到但金額為 null 的 PO
    const unmatchedOrders: string[] = []
    const nullAmountPos: string[] = []

    for (const sp of s.pis) {
      const slsOrder = sp.pi.order
      if (!slsOrder) {
        // standalone PI：用 piNo 對 poNo
        const piDocNo = extractDocNo(sp.pi.piNo)
        const po = poByPoNo.get(sp.pi.piNo) ?? poByPoNo.get(piDocNo)
        if (!po) unmatchedOrders.push(sp.pi.piNo)
        else if (!po.totalAmount && po.items.length === 0) nullAmountPos.push(po.poNo)
        continue
      }
      const bySlsId = poBySlsId.get(slsOrder.id) ?? []
      const lookupKey = slsOrder.orderNo
      const byNo = poByPoNo.get(lookupKey) ?? poByPoNo.get(extractDocNo(lookupKey))

      if (bySlsId.length === 0 && !byNo) {
        unmatchedOrders.push(slsOrder.orderNo)
      } else {
        const candidates = bySlsId.length > 0 ? bySlsId : (byNo ? [byNo] : [])
        for (const po of candidates) {
          if (!po.totalAmount && po.items.length === 0) nullAmountPos.push(po.poNo)
        }
      }
    }

    const warnings: string[] = []
    if (unmatchedOrders.length > 0)
      warnings.push(`${unmatchedOrders.length} 張訂單找不到 PO：${unmatchedOrders.join('、')}`)
    if (nullAmountPos.length > 0)
      warnings.push(`${nullAmountPos.length} 張 PO 金額為空：${nullAmountPos.join('、')}`)

    const collectedTWD = s.receivable?.collectedTWD ? Number(s.receivable.collectedTWD) : null
    const fxGainLoss = s.receivable?.fxGainLoss ? Number(s.receivable.fxGainLoss) : null
    // 實際毛利 = 實收TWD - 應付TWD（只在已收款時計算）
    const realGrossTWD = collectedTWD != null && apTWD > 0 ? collectedTWD - apTWD : null
    // 全部毛利 = 實際毛利 + 匯差
    const totalProfitTWD = realGrossTWD != null && fxGainLoss != null ? realGrossTWD + fxGainLoss : null

    return {
      shipmentId: s.id,
      shipmentNo: s.shipmentNo,
      actualShipDate: s.actualShipDate,
      customer: s.customer
        ? { id: s.customer.id, name: s.customer.shortName ?? s.customer.name }
        : { id: null, name: s.pis[0]?.pi.order?.orderNo ?? s.pis[0]?.pi.piNo ?? '—' },
      ar: {
        foreign: arForeign,
        currency: arCurrency,
        rate: ciRate > 0 ? 1 / ciRate : 0,
        twd: arTWD,
        fromRecord: arFromRecord,
        receivableStatus: s.receivable?.status ?? null,
        collectedTWD,
        fxGainLoss,
      },
      ap: {
        twd: apTWD,
        items: apItems,
        matchType: apMatchType,
      },
      gross: {
        twd: grossTWD,
        pct: grossPct,
      },
      realGross: {
        twd: realGrossTWD,
        totalProfit: totalProfitTWD,
      },
      hasPoLink: apItems.length > 0,
      warnings,
      unmatchedOrders,
      nullAmountPos,
    }
  })

  return NextResponse.json(rows)
}
