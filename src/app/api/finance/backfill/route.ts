import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

/**
 * POST /api/finance/backfill
 * 從現有出貨單和入庫記錄補建缺失的 FIN_Receivable / FIN_Payable。
 * 冪等：只建立不存在的記錄，不修改已有的。
 */
export async function POST() {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── AR：從 SLS_Shipment 補建 FIN_Receivable ────────────────────────────
  const shipmentsWithoutReceivable = await prisma.sLS_Shipment.findMany({
    where: {},
    include: {
      pis: {
        include: {
          pi: {
            include: {
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
    const orders = shipment.pis.map(sp => sp.pi.order).filter(o => o.totalAmount != null)

    // 無法確定金額 → 跳過，避免建出空殼記錄
    if (orders.length === 0) {
      arSkipped++
      continue
    }

    // 訂單金額加總（SLS_Order.totalAmount 是台幣，currencyCode=TWD，rate=1）
    const amountTWD = orders.reduce((s, o) => {
      const amt = Number(o.totalAmount ?? 0)
      const rate = Number(o.exchangeRate ?? 1)
      return s + (o.currencyCode === 'TWD' ? amt : amt * rate)
    }, 0)

    // ciExchangeRate 是 TWD→EUR（例如 0.0278 = 1 TWD = 0.0278 EUR）
    // amountForeign（EUR）= TWD × ciExchangeRate
    // rateAtInvoice（EUR→TWD）= 1 / ciExchangeRate
    const ciRate = Number(shipment.ciExchangeRate ?? 0)

    if (amountTWD <= 0 || ciRate <= 0) {
      arSkipped++
      continue
    }

    const amountForeign = amountTWD * ciRate          // EUR 金額
    const rateAtInvoice = 1 / ciRate                   // EUR→TWD 匯率（約 36）
    const customerId = shipment.customerId ?? orders.find(o => o.customerId)?.customerId ?? null

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

  // ── AP：從 PO_Receipt 補建 FIN_Payable ────────────────────────────────
  const receiptsWithoutPayable = await prisma.pO_Receipt.findMany({
    where: {},
    include: {
      order: {
        select: {
          supplierId: true,
          currencyCode: true,
          exchangeRate: true,
          totalAmount: true,
        },
      },
    },
  })

  let apCreated = 0
  let apSkipped = 0
  let apUpdated = 0

  for (const receipt of receiptsWithoutPayable) {
    const order = receipt.order
    if (!order.totalAmount || Number(order.totalAmount) <= 0) {
      apSkipped++
      continue
    }

    const amountTWD = Number(order.totalAmount) * Number(order.exchangeRate ?? 1)
    const existing = await prisma.fIN_Payable.findUnique({ where: { receiptId: receipt.id } })
    if (existing) {
      await prisma.fIN_Payable.update({
        where: { receiptId: receipt.id },
        data: { supplierId: order.supplierId, amountTWD },
      })
      apUpdated++
    } else {
      await prisma.fIN_Payable.create({
        data: { supplierId: order.supplierId, receiptId: receipt.id, amountTWD, status: 0 },
      })
      apCreated++
    }
  }

  return NextResponse.json({
    ok: true,
    ar: { created: arCreated, updated: arUpdated, skipped: arSkipped },
    ap: { created: apCreated, updated: apUpdated, skipped: apSkipped },
  })
}
