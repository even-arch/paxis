/**
 * Patisco Webhook 處理
 * Patisco 訂單確認後呼叫此端點，觸發 PAXIS 庫存扣減與採購建議
 */

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

/**
 * 處理 Patisco 訂單確認事件
 * 1. 扣減庫存
 * 2. 若庫存低於安全庫存，標記需要採購
 * 回傳需要補貨的商品清單（含建議供應商）
 */
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
    // 找對應的 PAXIS 商品
    const product = await prisma.pRD_Product.findFirst({
      where: {
        patiscoProductId: item.productId,
        isActive: true,
      },
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
      results.push({
        patiscoProductId: item.productId,
        sku: item.sku,
        deducted: 0,
        stockAfter: 0,
        belowSafety: false,
      })
      continue
    }

    const stock = product.inventoryItems[0]
    const newQty = Math.max(0, stock.quantity - item.quantity)

    // 更新庫存
    await prisma.iNV_Stock.update({
      where: { id: stock.id },
      data: { quantity: newQty },
    })

    // 寫入庫存異動紀錄（type=2 銷售出庫）
    await prisma.iNV_Movement.create({
      data: {
        productId: product.id,
        type: 2,
        quantity: -item.quantity,
        balanceAfter: newQty,
        patiscoOrderId: payload.orderId,
        patiscoOrderNo: payload.orderNo,
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
