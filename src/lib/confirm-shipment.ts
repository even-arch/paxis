import { PrismaClient, Prisma } from '@prisma/client'

/**
 * 確認出貨並記錄相關財務資訊：
 * 1. INV_Movement type=4（quantity--, reservedQty--）
 * 2. PO_CustomerCopy_Item.shippedQty 更新
 * 3. FIN_Receivable 建立（AR：應收帳款）
 * 4. PI.status = 2（已出貨）
 *
 * 冪等：已有 type=4 Movement 則跳過 INV 步驟，仍嘗試補建 AR。
 * 供 /api/shipments/[id]/confirm 與批次確認（customs-docs/confirm-all）共用。
 */
export async function confirmShipment(
  prisma: PrismaClient,
  shipmentId: number,
  performedBy: number | null,
): Promise<{ invConfirmed: number; invSkipped: number; arCreated: boolean }> {
  const shipment = await prisma.sLS.findUnique({
    where: { id: shipmentId },
    include: {
      customer: { select: { id: true } },
      items: {
        include: {
          slsItem: { select: { id: true, product: { select: { id: true } } } },
          pi: { select: { id: true } },
        },
      },
      pis: {
        include: {
          pi: {
            select: {
              id: true, piNo: true, orderId: true, totalAmount: true,
              currencyCode: true, extraCharges: true,
              order: {
                select: {
                  id: true, orderNo: true, exchangeRate: true,
                  totalAmount: true, currencyCode: true,
                  items: { select: { id: true, shippedQty: true, quantity: true } },
                },
              },
            },
          },
        },
      },
      stockMovements: { where: { type: 4 }, select: { id: true } },
    },
  })

  if (!shipment) throw new Error('找不到出貨單')

  const invAlreadyDone = shipment.stockMovements.length > 0

  const rawSkuItems = shipment.items.filter(i => !i.slsItem && i.rawSku && i.piId)
  const piItemLookup = new Map<string, number>()

  if (rawSkuItems.length > 0) {
    const piIds = Array.from(new Set(rawSkuItems.map(i => i.piId!)))
    const piItems = await prisma.pI_Item.findMany({
      where: { piId: { in: piIds } },
      select: {
        piId: true,
        slsItem: { select: { id: true, product: { select: { id: true, sku: true } } } },
        product: { select: { id: true, sku: true } },
      },
    })
    for (const pi of piItems) {
      const prod = pi.slsItem?.product ?? pi.product
      if (prod?.sku) piItemLookup.set(`${pi.piId}:${prod.sku}`, prod.id)
    }
  }

  const result = { invConfirmed: 0, invSkipped: 0, arCreated: false }

  // ── 1. INV_Movement type=4 + PO_CustomerCopy_Item.shippedQty ─────────────
  if (invAlreadyDone) {
    result.invSkipped = shipment.items.length
  }
  for (const item of invAlreadyDone ? [] : shipment.items) {
    const productId = item.slsItem?.product?.id
      ?? (item.piId && item.rawSku ? piItemLookup.get(`${item.piId}:${item.rawSku}`) : undefined)

    if (!productId) { result.invSkipped++; continue }

    const stock = await prisma.iNV_Stock.findUnique({ where: { productId } })
    const currentQty = stock?.quantity ?? 0
    const currentReserved = stock?.reservedQty ?? 0
    const reservedDecrement = Math.min(item.quantity, Math.max(0, currentReserved))

    await prisma.iNV_Stock.upsert({
      where: { productId },
      create: { productId, quantity: -item.quantity, reservedQty: 0, safetyStock: 0 },
      update: {
        quantity: { decrement: item.quantity },
        ...(reservedDecrement > 0 ? { reservedQty: { decrement: reservedDecrement } } : {}),
      },
    })

    const updatedStock = await prisma.iNV_Stock.findUnique({ where: { productId } })
    await prisma.iNV_Movement.create({
      data: {
        productId, type: 4,
        qtyDelta: -item.quantity,
        reservedDelta: -reservedDecrement,
        quantityAfter: updatedStock?.quantity ?? currentQty - item.quantity,
        reservedAfter: updatedStock?.reservedQty ?? currentReserved - reservedDecrement,
        slsShipmentId: shipmentId,
        source: 'MANUAL', performedBy,
        patiscoDocId: shipment.patiscoDocId ?? undefined,
        patiscoDocNo: shipment.patiscoDocNo ?? undefined,
      },
    })

    if (item.slsItem?.id) {
      await prisma.pO_CustomerCopy_Item.update({
        where: { id: item.slsItem.id },
        data: { shippedQty: { increment: item.quantity } },
      })
    }
    result.invConfirmed++
  }

  // ── 2. FIN_Receivable（AR）────────────────────────────────────────────
  const existingAR = await prisma.fIN_Receivable.findUnique({ where: { shipmentId } })
  if (!existingAR) {
    const ciRate = Number(shipment.ciExchangeRate ?? 0)

    const calcExtraCharges = (ec: unknown): number => {
      if (!ec || !Array.isArray(ec)) return 1
      let pct = 0
      for (const c of ec as { type?: string; amount?: string }[]) {
        if (c.amount && c.type !== '1') pct += Number(c.amount)
      }
      return 1 + pct / 100
    }

    let amountForeignFromItems = 0
    let itemsWithPrice = 0
    for (const item of shipment.items) {
      const up = (item as unknown as { unitPrice?: { toString(): string } | null }).unitPrice
      if (up != null) {
        amountForeignFromItems += item.quantity * Number(up)
        itemsWithPrice++
      }
    }

    let amountTWD = 0
    let amountForeign = 0

    if (itemsWithPrice > 0 && ciRate > 0) {
      amountForeign = amountForeignFromItems
      amountTWD = amountForeign / ciRate
    } else if (itemsWithPrice > 0) {
      amountForeign = amountForeignFromItems
      amountTWD = amountForeignFromItems
    } else {
      for (const sp of shipment.pis) {
        const totalAmt = sp.pi.totalAmount
        const currCode = sp.pi.currencyCode ?? 'TWD'
        if (!totalAmt) continue
        const base = currCode === 'TWD'
          ? Number(totalAmt)
          : (ciRate > 0 ? Number(totalAmt) / ciRate : Number(totalAmt))
        amountTWD += base * calcExtraCharges(sp.pi.extraCharges)
      }
      amountForeign = ciRate > 0 ? amountTWD * ciRate : amountTWD
    }

    if (amountTWD > 0) {
      const rateAtInvoice = ciRate > 0 ? 1 / ciRate : 1
      const currencyCode = shipment.currencyCode ?? (ciRate > 0 ? 'EUR' : 'TWD')
      await prisma.fIN_Receivable.create({
        data: {
          shipmentId,
          customerId: shipment.customerId ?? undefined,
          currencyCode,
          amountForeign: new Prisma.Decimal(amountForeign),
          rateAtInvoice: new Prisma.Decimal(rateAtInvoice),
          amountTWD: new Prisma.Decimal(amountTWD),
          status: 0,
        },
      })
      result.arCreated = true
    }
  }

  // ── 3. 應付帳款由用戶手工創建（對帳頁面），此處不動 ──────────────────

  // ── 4. PI.status = 2（已出貨）─────────────────────────────────────────
  const piIds = shipment.pis.map(sp => sp.pi.id)
  if (piIds.length > 0) {
    await prisma.pI.updateMany({
      where: { id: { in: piIds }, status: 0 },
      data: { status: 2 },
    })
  }

  return result
}
