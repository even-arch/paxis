import { PrismaClient } from '@prisma/client'

/**
 * 計算並 upsert 某張出貨單的 AP payable（item-level 成本分攤）
 *
 * 分箱邏輯：若同一張 PI 被多張出貨單使用（SLS_PI_Link.count > 1），
 * 視為分箱出貨，禁止 fallback 到 PO 全額，避免 double counting。
 */
export async function calcAndUpsertPayables(
  prisma: PrismaClient,
  shipmentId: number,
): Promise<{ created: number; updated: number; skipped: number }> {
  const shipment = await prisma.sLS.findUnique({
    where: { id: shipmentId },
    include: {
      items: { select: { rawSku: true, quantity: true, piId: true } },
    },
  })
  if (!shipment || shipment.items.length === 0) return { created: 0, updated: 0, skipped: 0 }

  // group SLS_Items by piId
  const byPi = new Map<number, { rawSku: string; quantity: number }[]>()
  for (const item of shipment.items) {
    if (!item.piId || !item.rawSku) continue
    if (!byPi.has(item.piId)) byPi.set(item.piId, [])
    byPi.get(item.piId)!.push({ rawSku: item.rawSku, quantity: Number(item.quantity) })
  }

  let created = 0, updated = 0, skipped = 0

  for (const [piId, piItems] of Array.from(byPi)) {
    // 分箱判斷：同張 PI 被幾張出貨單使用
    const piShipmentCount = await prisma.sLS_PI_Link.count({ where: { piId } })
    const isPartialShipment = piShipmentCount > 1

    const pi = await prisma.pI.findUnique({
      where: { id: piId },
      include: {
        poOrders: {
          select: {
            id: true,
            supplierId: true,
            exchangeRate: true,
            totalAmount: true,
            items: {
              select: {
                unitPrice: true,
                product: { select: { sku: true } },
              },
            },
          },
        },
      },
    })
    if (!pi) continue

    for (const po of pi.poOrders) {
      const exRate = Number(po.exchangeRate ?? 1)
      const skuPrice = new Map<string, number>()
      for (const item of po.items) {
        const sku = item.product?.sku
        if (sku && item.unitPrice) skuPrice.set(sku, Number(item.unitPrice) * exRate)
      }

      let amountTWD = 0
      let matched = 0
      for (const { rawSku, quantity } of piItems) {
        const price = skuPrice.get(rawSku)
        if (price != null) { amountTWD += price * quantity; matched++ }
      }

      // SKU 覆蓋率不足時的 fallback 策略
      if (matched === 0 || matched < piItems.length * 0.5) {
        if (!isPartialShipment && po.totalAmount) {
          // 非分箱：可用 PO 全額作 fallback
          amountTWD = Number(po.totalAmount) * exRate
        } else {
          // 分箱出貨：絕對不能用 PO 全額，跳過等待手動修正
          skipped++
          continue
        }
      }

      if (amountTWD <= 0) { skipped++; continue }

      const existing = await prisma.fIN_Payable.findUnique({
        where: { shipmentId_poId: { shipmentId, poId: po.id } },
      })

      if (existing) {
        // 已付款的 payable 不覆蓋
        if (existing.status > 0) { skipped++; continue }
        await prisma.fIN_Payable.update({
          where: { id: existing.id },
          data: { supplierId: po.supplierId, amountTWD },
        })
        updated++
      } else {
        await prisma.fIN_Payable.create({
          data: { supplierId: po.supplierId, shipmentId, poId: po.id, amountTWD, status: 0 },
        })
        created++
      }
    }
  }

  return { created, updated, skipped }
}
