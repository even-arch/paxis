import { prisma } from '@/lib/db'

export type PatiscoOrderConfirmedPayload = {
  event: 'order.confirmed'
  orderId: number
  orderNo: string
  items: Array<{
    productId: number   // Patisco PRD_Product.ID
    sku: string
    quantity: number
  }>
}

export async function handleOrderConfirmed(payload: PatiscoOrderConfirmedPayload) {
  const results: Array<{
    patiscoProductId: number
    sku: string
    deducted: number
    stockAfter: number
    belowSafety: boolean
    suggestedSupplier?: { id: number; name: string }
  }> = []

  for (const item of payload.items) {
    const product = await prisma.pRD_Product.findFirst({
      where: { patiscoProductId: item.productId, isActive: true },
      include: {
        inventoryItems: true,
        supplierProducts: {
          where: { isPreferred: true },
          include: { supplier: { select: { id: true, name: true } } },
          take: 1,
        },
      },
    })

    if (!product || !product.inventoryItems[0]) {
      results.push({ patiscoProductId: item.productId, sku: item.sku, deducted: 0, stockAfter: 0, belowSafety: false })
      continue
    }

    const stock = product.inventoryItems[0]
    const newQty = Math.max(0, stock.quantity - item.quantity)

    await prisma.iNV_Stock.update({
      where: { id: stock.id },
      data: { quantity: newQty },
    })

    // 新 schema：type=4 出倉（PI 正本確認後裝箱出倉）
    await prisma.iNV_Movement.create({
      data: {
        productId: product.id,
        type: 4,
        qtyDelta: -item.quantity,
        reservedDelta: 0,
        quantityAfter: newQty,
        reservedAfter: stock.reservedQty,
        patiscoDocType: 'DELIVERY_ORDER',
        patiscoDocId: payload.orderId,
        patiscoDocNo: payload.orderNo,
        note: `Patisco 訂單 ${payload.orderNo}`,
      },
    })

    const belowSafety = newQty <= stock.safetyStock
    const preferred = product.supplierProducts[0]

    results.push({
      patiscoProductId: item.productId,
      sku: item.sku,
      deducted: item.quantity,
      stockAfter: newQty,
      belowSafety,
      suggestedSupplier: preferred
        ? { id: preferred.supplier.id, name: preferred.supplier.name }
        : undefined,
    })
  }

  return results
}
