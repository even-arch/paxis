import { PrismaClient } from '@prisma/client'

/**
 * 計算並 upsert 某張出貨單的 AR receivable（item-level，直接從 SLS_Item.unitPrice 加總）
 *
 * 分箱邏輯天然成立：SLS_Item 只含本次出貨的品項，加總後就是本次出貨的應收金額，
 * 不需要額外做比例拆分，也不會有 double counting。
 *
 * 幣別固定 EUR（CI 報關匯率），若 ciExchangeRate 或 unitPrice 缺失則 skip。
 */
export async function calcAndUpsertReceivable(
  prisma: PrismaClient,
  shipmentId: number,
): Promise<{ created: number; updated: number; skipped: number }> {
  const shipment = await prisma.sLS.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      customerId: true,
      ciExchangeRate: true,
      items: { select: { quantity: true, unitPrice: true } },
    },
  })

  if (!shipment) return { created: 0, updated: 0, skipped: 1 }

  const ciRate = Number(shipment.ciExchangeRate ?? 0)

  // 從 SLS_Item 加總 CI 金額（外幣，通常 EUR）
  const amountForeign = shipment.items.reduce((s, item) => {
    if (!item.unitPrice) return s
    return s + Number(item.quantity) * Number(item.unitPrice)
  }, 0)

  if (amountForeign <= 0 || ciRate <= 0) {
    return { created: 0, updated: 0, skipped: 1 }
  }

  // ciRate = TWD→EUR（e.g. 0.02717）→ EUR→TWD = amountForeign / ciRate
  const amountTWD = amountForeign / ciRate
  const rateAtInvoice = 1 / ciRate // EUR→TWD 匯率（約 36～38）

  const existing = await prisma.fIN_Receivable.findUnique({ where: { shipmentId } })

  if (existing) {
    // 已收款的不覆蓋
    if (existing.status > 0) return { created: 0, updated: 0, skipped: 1 }
    await prisma.fIN_Receivable.update({
      where: { shipmentId },
      data: {
        customerId: shipment.customerId ?? undefined,
        currencyCode: 'EUR',
        amountForeign,
        rateAtInvoice,
        amountTWD,
      },
    })
    return { created: 0, updated: 1, skipped: 0 }
  } else {
    await prisma.fIN_Receivable.create({
      data: {
        shipmentId,
        customerId: shipment.customerId ?? undefined,
        currencyCode: 'EUR',
        amountForeign,
        rateAtInvoice,
        amountTWD,
        status: 0,
      },
    })
    return { created: 1, updated: 0, skipped: 0 }
  }
}
