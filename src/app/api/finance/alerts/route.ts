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
              id: true,
              piNo: true,
              orderId: true,
              totalAmount: true,
              currencyCode: true,
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
      id: true, poNo: true, totalAmount: true, currencyCode: true, exchangeRate: true,
      slsPiId: true, salesOrderId: true,
      items: { select: { unitPrice: true, quantity: true } },
    },
  })

  function extractDocNo(str: string): string {
    const m = str.match(/\b([A-Z]{1,3}\d{5,})\b/)
    if (m) return m[1]
    return str.split(' ')[0]
  }

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

    // AR = SLS_PI.totalAmount（我方 PI 金額，最終確認的客戶價格）
    const arTWD = s.pis.reduce((sum, sp) => {
      const totalAmt = sp.pi.totalAmount
      const currCode = sp.pi.currencyCode ?? 'TWD'
      if (!totalAmt) return sum
      const base = currCode === 'TWD' ? Number(totalAmt) : Number(totalAmt) * Number(sp.pi.order?.exchangeRate ?? 1)
      return sum + base * calcExtraCharges(sp.pi.extraCharges)
    }, 0)

    // AP = PO_Order.totalAmount（付給供應商的採購金額）
    // 主路徑A：PO.slsPiId = SLS_PI.id；主路徑B：PO.poNo = SLS_PI.piNo；次路徑：salesOrderId
    let apTWD = 0
    const unmatchedPIs: string[] = []
    const nullAmountPos: string[] = []

    for (const sp of s.pis) {
      // 主路徑A
      const byPiId = poByPiId.get(sp.pi.id)
      if (byPiId) {
        const amt = poAmountTWD(byPiId)
        if (amt <= 0) nullAmountPos.push(byPiId.poNo)
        else apTWD += amt
        continue
      }

      // 主路徑B：piNo = poNo
      const piDocNo = extractDocNo(sp.pi.piNo)
      const byPiNo = poByPoNo.get(sp.pi.piNo) ?? poByPoNo.get(piDocNo)
      if (byPiNo) {
        const amt = poAmountTWD(byPiNo)
        if (amt <= 0) nullAmountPos.push(byPiNo.poNo)
        else apTWD += amt
        continue
      }

      // 次路徑：salesOrderId
      const slsOrder = sp.pi.order
      const bySlsId = slsOrder ? (poBySlsId.get(slsOrder.id) ?? []) : []
      const lookupKey = slsOrder ? slsOrder.orderNo : sp.pi.piNo
      const byNo = poByPoNo.get(lookupKey) ?? poByPoNo.get(extractDocNo(lookupKey))
      const candidates = bySlsId.length > 0 ? bySlsId : (byNo ? [byNo] : [])

      if (candidates.length === 0) {
        unmatchedPIs.push(sp.pi.piNo)
      } else {
        for (const po of candidates) {
          const amt = poAmountTWD(po)
          if (amt <= 0) nullAmountPos.push(po.poNo)
          else apTWD += amt
        }
      }
    }

    if (unmatchedPIs.length > 0)
      issues.push(`${unmatchedPIs.length} 張 PI 找不到對應採購單（${unmatchedPIs.slice(0, 3).join('、')}${unmatchedPIs.length > 3 ? '…' : ''}）`)
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
