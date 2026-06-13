import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/finance/estimates
 * 以出貨單為錨點，估算每張出貨的應收（AR）與應付（AP），計算毛利。
 * 純估算，不依賴 PO_Receipt，不建立任何記錄。
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipments = await prisma.sLS_Shipment.findMany({
    orderBy: { actualShipDate: 'desc' },
    include: {
      customer: { select: { id: true, name: true, shortName: true } },
      receivable: {
        select: {
          id: true,
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
                  purchaseOrders: {
                    select: {
                      id: true,
                      poNo: true,
                      totalAmount: true,
                      currencyCode: true,
                      exchangeRate: true,
                      supplier: { select: { id: true, name: true, shortName: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  const rows = shipments.map(s => {
    // AR：優先用已建的 FIN_Receivable，否則從訂單加總估算
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

    // AP：從銷售訂單 → 採購訂單推算（取供應商 PI 金額，若無則用 PO 金額）
    const poMap = new Map<number, { poNo: string; supplierName: string; amountTWD: number; currency: string }>()
    for (const sp of s.pis) {
      for (const po of sp.pi.order.purchaseOrders) {
        if (poMap.has(po.id)) continue
        if (!po.totalAmount) continue
        const rate = Number(po.exchangeRate ?? 1)
        const amountTWD = Number(po.totalAmount) * rate
        poMap.set(po.id, {
          poNo: po.poNo,
          supplierName: po.supplier.shortName ?? po.supplier.name,
          amountTWD,
          currency: po.currencyCode,
        })
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
