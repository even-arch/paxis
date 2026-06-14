import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export type Alert = {
  shipmentId: number
  shipmentNo: string
  level: 'warn' | 'error'
  issues: string[]
  grossPct: number | null
}

/**
 * GET /api/finance/alerts
 * 快速規則型異常偵測：毛利率異常、PO 缺失、AP 金額空白。
 * 只回傳有問題的出貨單，給鈴鐺圖示用。
 */
export async function GET() {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipments = await prisma.sLS_Shipment.findMany({
    orderBy: { actualShipDate: 'desc' },
    take: 60,  // 只看近 60 張，避免太慢
    include: {
      pis: {
        include: {
          pi: {
            select: {
              orderId: true,
              extraCharges: true,
              order: {
                select: { id: true, orderNo: true, totalAmount: true, currencyCode: true, exchangeRate: true },
              },
            },
          },
        },
      },
    },
  })

  const allPOs = await prisma.pO_Order.findMany({
    select: {
      id: true, poNo: true, totalAmount: true, currencyCode: true, exchangeRate: true, salesOrderId: true,
      items: { select: { unitPrice: true, quantity: true } },
    },
  })

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
    const base = po.totalAmount
      ? Number(po.totalAmount)
      : po.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0)
    return base * Number(po.exchangeRate ?? 1)
  }

  function calcExtraCharges(ec: unknown): number {
    if (!ec || !Array.isArray(ec)) return 1
    let pct = 0
    for (const c of ec as { type?: string; amount?: string }[]) {
      if (c.amount && c.type !== '1') pct += Number(c.amount)
    }
    return 1 + pct / 100
  }

  const alerts: Alert[] = []

  for (const s of shipments) {
    const issues: string[] = []

    // 計算 AR TWD
    const arTWD = s.pis.reduce((sum, sp) => {
      const o = sp.pi.order
      if (!o.totalAmount) return sum
      const base = o.currencyCode === 'TWD' ? Number(o.totalAmount) : Number(o.totalAmount) * Number(o.exchangeRate ?? 1)
      return sum + base * calcExtraCharges(sp.pi.extraCharges)
    }, 0)

    // 計算 AP 並找出問題
    let apTWD = 0
    const unmatchedOrders: string[] = []
    const nullAmountPos: string[] = []

    for (const sp of s.pis) {
      const slsOrder = sp.pi.order
      const bySlsId = poBySlsId.get(slsOrder.id) ?? []
      const byNo = poByPoNo.get(slsOrder.orderNo)

      if (bySlsId.length === 0 && !byNo) {
        unmatchedOrders.push(slsOrder.orderNo)
      } else {
        const candidates = bySlsId.length > 0 ? bySlsId : (byNo ? [byNo] : [])
        for (const po of candidates) {
          const amt = poAmountTWD(po)
          if (amt <= 0) nullAmountPos.push(po.poNo)
          else apTWD += amt
        }
      }
    }

    if (unmatchedOrders.length > 0)
      issues.push(`${unmatchedOrders.length} 張訂單找不到 PO（${unmatchedOrders.slice(0, 3).join('、')}${unmatchedOrders.length > 3 ? '…' : ''}）`)
    if (nullAmountPos.length > 0)
      issues.push(`${nullAmountPos.length} 張 PO 金額為空（${nullAmountPos.slice(0, 2).join('、')}${nullAmountPos.length > 2 ? '…' : ''}）`)

    const grossPct = arTWD > 0 ? ((arTWD - apTWD) / arTWD) * 100 : null

    if (grossPct !== null && grossPct > 55)
      issues.push(`毛利率 ${grossPct.toFixed(1)}%，明顯偏高`)
    if (grossPct !== null && grossPct < 0)
      issues.push(`毛利為負（${grossPct.toFixed(1)}%）`)

    if (issues.length > 0) {
      alerts.push({
        shipmentId: s.id,
        shipmentNo: s.shipmentNo ?? `#${s.id}`,
        level: (grossPct !== null && (grossPct > 55 || grossPct < 0)) ? 'error' : 'warn',
        issues,
        grossPct,
      })
    }
  }

  return NextResponse.json({ alerts, total: alerts.length })
}
