import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { calcAndUpsertPayables } from '@/lib/ap-payable'

/**
 * POST /api/finance/backfill
 * 從現有出貨單和入庫記錄補建缺失的 FIN_Receivable / FIN_Payable。
 * 冪等：只建立不存在的記錄，不修改已有的。
 */
export async function POST() {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── AR：從 SLS 補建 FIN_Receivable ────────────────────────────
  const shipmentsWithoutReceivable = await prisma.sLS.findMany({
    where: {},
    include: {
      pis: {
        include: {
          pi: {
            select: {
              totalAmount: true,
              currencyCode: true,
              order: {
                select: {
                  customerId: true,
                  currencyCode: true,
                  exchangeRate: true,
                  totalAmount: true,
                },
              },
            },
          },
        },
      },
    },
  })

  let arCreated = 0
  let arSkipped = 0
  let arUpdated = 0

  for (const shipment of shipmentsWithoutReceivable) {
    // 嘗試從 PI.order 或 PI 本身取得金額
    // PI 是主，PO_CustomerCopy 只做 fallback
    const piAmounts = shipment.pis.map(sp => ({
      totalAmount: sp.pi.totalAmount ?? sp.pi.order?.totalAmount,
      currencyCode: sp.pi.currencyCode ?? sp.pi.order?.currencyCode ?? 'TWD',
      orderExchangeRate: sp.pi.order?.exchangeRate ?? null,
      customerId: sp.pi.order?.customerId ?? null,
    })).filter(o => o.totalAmount != null)

    if (piAmounts.length === 0) {
      arSkipped++
      continue
    }

    const ciRate = Number(shipment.ciExchangeRate ?? 0)

    // PI 金額加總：EUR → TWD 用報帳匯率（ciExchangeRate）倒算
    const amountTWD = piAmounts.reduce((s, o) => {
      const amt = Number(o.totalAmount ?? 0)
      if (o.currencyCode === 'TWD') return s + amt
      // ciRate = TWD→EUR（e.g. 0.02717），所以 EUR→TWD = amt / ciRate
      if (ciRate > 0) return s + amt / ciRate
      // fallback：PO_CustomerCopy.exchangeRate（EUR→TWD 方向）
      return s + amt * Number(o.orderExchangeRate ?? 1)
    }, 0)

    if (amountTWD <= 0 || ciRate <= 0) {
      arSkipped++
      continue
    }

    const amountForeign = amountTWD * ciRate          // EUR 金額
    const rateAtInvoice = 1 / ciRate                   // EUR→TWD 匯率（約 36）
    const customerId = shipment.customerId ?? piAmounts.find(o => o.customerId)?.customerId ?? null

    const existing = await prisma.fIN_Receivable.findUnique({ where: { shipmentId: shipment.id } })
    if (existing) {
      await prisma.fIN_Receivable.update({
        where: { shipmentId: shipment.id },
        data: { customerId, currencyCode: 'EUR', amountForeign, rateAtInvoice, amountTWD },
      })
      arUpdated++
    } else {
      await prisma.fIN_Receivable.create({
        data: { shipmentId: shipment.id, customerId, currencyCode: 'EUR', amountForeign, rateAtInvoice, amountTWD, status: 0 },
      })
      arCreated++
    }
  }

  // ── AP：從 SLS_Shipment 補建 FIN_Payable（item-level 成本分攤）─────
  const allShipments = await prisma.sLS.findMany({ select: { id: true } })
  let apCreated = 0, apSkipped = 0, apUpdated = 0
  for (const { id } of allShipments) {
    const r = await calcAndUpsertPayables(prisma, id)
    apCreated += r.created
    apUpdated += r.updated
    apSkipped += r.skipped
  }

  return NextResponse.json({
    ok: true,
    ar: { created: arCreated, updated: arUpdated, skipped: arSkipped },
    ap: { created: apCreated, updated: apUpdated, skipped: apSkipped },
  })
}
