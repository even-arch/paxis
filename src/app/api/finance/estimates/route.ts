import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
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
            include: {
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

  const rows = shipments.map(s => {
    // ── AR ────────────────────────────────────────────────────────────────
    let arForeign = 0
    let arCurrency = s.currencyCode ?? 'EUR'
    let arRate = Number(s.ciExchangeRate ?? 0)
    let arTWD = 0
    let arFromRecord = false

    if (s.receivable) {
      arForeign = Number(s.receivable.amountForeign)
      arCurrency = s.receivable.currencyCode
      arRate = Number(s.receivable.rateAtInvoice)
      arTWD = Number(s.receivable.amountTWD)
      arFromRecord = true
    } else {
      const orders = s.pis.map(sp => sp.pi.order).filter(o => o.totalAmount != null)
      arForeign = orders.reduce((sum, o) => sum + Number(o.totalAmount ?? 0), 0)
      if (orders[0]) arCurrency = orders[0].currencyCode
      arRate = arRate || Number(orders[0]?.exchangeRate ?? 0)
      arTWD = arForeign * arRate
    }

    // ── AP：三層 fallback ──────────────────────────────────────────────────
    // 1. salesOrderId 直連（最準確）
    // 2. poNo = SLS_Order.orderNo（大多數 Patisco 資料）
    // 3. 找不到 → 顯示 —
    const poMap = new Map<number, { poNo: string; supplierName: string; amountTWD: number; currency: string; matchType: string }>()

    for (const sp of s.pis) {
      const slsOrder = sp.pi.order

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

    return {
      shipmentId: s.id,
      shipmentNo: s.shipmentNo,
      actualShipDate: s.actualShipDate,
      customer: s.customer
        ? { id: s.customer.id, name: s.customer.shortName ?? s.customer.name }
        : { id: null, name: s.pis[0]?.pi.order.orderNo ?? '—' },
      ar: {
        foreign: arForeign,
        currency: arCurrency,
        rate: arRate,
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
    }
  })

  return NextResponse.json(rows)
}
