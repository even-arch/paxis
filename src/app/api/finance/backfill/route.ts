import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * POST /api/finance/backfill
 * 從現有出貨單和入庫記錄補建缺失的 FIN_Receivable / FIN_Payable。
 * 冪等：只建立不存在的記錄，不修改已有的。
 */
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── AR：從 SLS_Shipment 補建 FIN_Receivable ────────────────────────────
  const shipmentsWithoutReceivable = await prisma.sLS_Shipment.findMany({
    where: { receivable: null },
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

  for (const shipment of shipmentsWithoutReceivable) {
    const orders = shipment.pis.map(sp => sp.pi.order).filter(o => o.totalAmount != null)

    // 無法確定金額 → 跳過，避免建出空殼記錄
    if (orders.length === 0) {
      arSkipped++
      continue
    }

    // 所有關聯訂單金額加總（通常是同一幣別）
    const currency = orders[0].currencyCode
    const amountForeign = orders.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0)
    const rate = Number(shipment.ciExchangeRate ?? orders[0].exchangeRate ?? 0)

    if (amountForeign <= 0 || rate <= 0) {
      arSkipped++
      continue
    }

    const customerId = shipment.customerId ?? orders.find(o => o.customerId)?.customerId ?? null

    await prisma.fIN_Receivable.create({
      data: {
        shipmentId: shipment.id,
        customerId,
        currencyCode: currency,
        amountForeign,
        rateAtInvoice: rate,
        amountTWD: amountForeign * rate,
        status: 0,
      },
    })
    arCreated++
  }

  // ── AP：從 PO_Receipt 補建 FIN_Payable ────────────────────────────────
  const receiptsWithoutPayable = await prisma.pO_Receipt.findMany({
    where: { payable: null },
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

  for (const receipt of receiptsWithoutPayable) {
    const order = receipt.order
    if (!order.totalAmount || Number(order.totalAmount) <= 0) {
      apSkipped++
      continue
    }

    const amountTWD = Number(order.totalAmount) * Number(order.exchangeRate ?? 1)

    await prisma.fIN_Payable.create({
      data: {
        supplierId: order.supplierId,
        receiptId: receipt.id,
        amountTWD,
        status: 0,
      },
    })
    apCreated++
  }

  return NextResponse.json({
    ok: true,
    ar: { created: arCreated, skipped: arSkipped },
    ap: { created: apCreated, skipped: apSkipped },
  })
}
