import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function GET() {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 預載所有 PO_Order（含品項金額）— 用於 poNo 配對
  const allPOs = await prisma.pO_Order.findMany({
    select: {
      id: true,
      poNo: true,
      totalAmount: true,
      currencyCode: true,
      exchangeRate: true,
      salesOrderId: true,
      supplier: { select: { id: true, name: true, shortName: true } },
      items: { select: { unitPrice: true, quantity: true } },
    },
  })

  // 建立兩個查詢 map：salesOrderId → PO，及 poNo → PO
  const poBySlsId = new Map<number, typeof allPOs>()
  const poByPoNo = new Map<string, typeof allPOs[0]>()
  for (const po of allPOs) {
    if (po.salesOrderId) {
      const arr = poBySlsId.get(po.salesOrderId) ?? []
      arr.push(po)
      poBySlsId.set(po.salesOrderId, arr)
    }
    poByPoNo.set(po.poNo, po)
  }

  function poAmountTWD(po: typeof allPOs[0]): number {
    // 優先用 totalAmount，否則從品項加總
    const base = po.totalAmount
      ? Number(po.totalAmount)
      : po.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0)
    return base * Number(po.exchangeRate ?? 1)
  }

  const shipments = await prisma.sLS_Shipment.findMany({
    orderBy: { actualShipDate: 'desc' },
    include: {
      customer: { select: { id: true, name: true, shortName: true } },
      receivable: {
        select: {
          amountForeign: true,
          currencyCode: true,
          rateAtInvoice: true,
          amountTWD: true,
          status: true,
        },
      },
      pis: {
        include: {
          pi: {
            select: {
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
    // SLS_Order.totalAmount 是台幣金額，不需再乘匯率
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
        const totalAmt = sp.pi.order?.totalAmount ?? sp.pi.totalAmount
        const currCode = sp.pi.order?.currencyCode ?? sp.pi.currencyCode ?? 'TWD'
        const exchRate = sp.pi.order?.exchangeRate ?? 1
        if (!totalAmt) return sum
        const base = currCode === 'TWD'
          ? Number(totalAmt)
          : Number(totalAmt) * Number(exchRate)
        const { pctMultiplier, flatTWD } = calcExtraCharges(sp.pi.extraCharges)
        return sum + base * pctMultiplier + flatTWD
      }, 0)
      arForeign = ciRate > 0 ? arTWD * ciRate : 0
    }

    // ── AP：三層 fallback ──────────────────────────────────────────────────
    // 1. salesOrderId 直連（最準確）
    // 2. poNo = SLS_Order.orderNo（大多數 Patisco 資料）
    // 3. 找不到 → 顯示 —
    const poMap = new Map<number, { poNo: string; supplierName: string; amountTWD: number; currency: string; matchType: string }>()

    for (const sp of s.pis) {
      const slsOrder = sp.pi.order
      if (!slsOrder) continue  // standalone PI — no SLS_Order to match PO against

      // fallback 1：salesOrderId
      const bySlsId = poBySlsId.get(slsOrder.id) ?? []
      for (const po of bySlsId) {
        if (poMap.has(po.id)) continue
        poMap.set(po.id, {
          poNo: po.poNo,
          supplierName: po.supplier.shortName ?? po.supplier.name,
          amountTWD: poAmountTWD(po),
          currency: po.currencyCode,
          matchType: 'linked',
        })
      }

      // fallback 2：poNo = orderNo
      if (bySlsId.length === 0) {
        const po = poByPoNo.get(slsOrder.orderNo)
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

    const apItems = Array.from(poMap.values())
    const apTWD = apItems.reduce((sum, p) => sum + p.amountTWD, 0)
    const grossTWD = arTWD - apTWD
    const grossPct = arTWD > 0 ? (grossTWD / arTWD) * 100 : null

    // 診斷：找出沒配到 PO 的 order，以及配到但金額為 null 的 PO
    const unmatchedOrders: string[] = []
    const nullAmountPos: string[] = []

    for (const sp of s.pis) {
      const slsOrder = sp.pi.order
      if (!slsOrder) continue  // standalone PI — skip PO matching diagnosis
      const bySlsId = poBySlsId.get(slsOrder.id) ?? []
      const byNo = poByPoNo.get(slsOrder.orderNo)

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
      },
      ap: {
        twd: apTWD,
        items: apItems,
      },
      gross: {
        twd: grossTWD,
        pct: grossPct,
      },
      hasPoLink: apItems.length > 0,
      warnings,
      unmatchedOrders,
      nullAmountPos,
    }
  })

  return NextResponse.json(rows)
}
