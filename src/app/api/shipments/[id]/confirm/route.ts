import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

/**
 * POST /api/shipments/[id]/confirm
 * 驅動出貨：為現有 SLS_Shipment 寫入 INV_Movement type=4（quantity--, reservedQty--）。
 * 冪等保護：若此出貨單已存在 type=4 的 Movement，拒絕重複執行。
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = parseInt(params.id, 10)
  if (isNaN(shipmentId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const shipment = await prisma.sLS_Shipment.findUnique({
    where: { id: shipmentId },
    include: {
      items: {
        include: {
          slsItem: { select: { product: { select: { id: true } } } },
          pi: { select: { id: true } },
        },
      },
      stockMovements: { where: { type: 4 }, select: { id: true } },
    },
  })

  if (!shipment) return NextResponse.json({ error: '找不到出貨單' }, { status: 404 })

  if (shipment.stockMovements.length > 0) {
    return NextResponse.json({ error: '此出貨單已完成庫存扣減，請勿重複執行' }, { status: 409 })
  }

  // 建立 sku → productId map（從 piId 的 PIItem 補查）
  const rawSkuItems = shipment.items.filter(i => !i.slsItem && i.rawSku && i.piId)
  const piItemLookup = new Map<string, number>() // `${piId}:${sku}` → productId

  if (rawSkuItems.length > 0) {
    const piIds = Array.from(new Set(rawSkuItems.map(i => i.piId!)))
    const piItems = await prisma.sLS_PIItem.findMany({
      where: { piId: { in: piIds } },
      select: {
        piId: true,
        slsItem: { select: { product: { select: { id: true, sku: true } } } },
        product: { select: { id: true, sku: true } },
      },
    })
    for (const pi of piItems) {
      const prod = pi.slsItem?.product ?? pi.product
      if (prod?.sku) piItemLookup.set(`${pi.piId}:${prod.sku}`, prod.id)
    }
  }

  let confirmed = 0
  let skipped = 0

  try {
    for (const item of shipment.items) {
      const productId = item.slsItem?.product?.id
        ?? (item.piId && item.rawSku ? piItemLookup.get(`${item.piId}:${item.rawSku}`) : undefined)

      if (!productId) { skipped++; continue }

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
          productId,
          type: 4,
          qtyDelta: -item.quantity,
          reservedDelta: -reservedDecrement,
          quantityAfter: updatedStock?.quantity ?? currentQty - item.quantity,
          reservedAfter: updatedStock?.reservedQty ?? currentReserved - reservedDecrement,
          slsShipmentId: shipmentId,
          source: 'MANUAL',
          performedBy: (() => { const uid = ((session.user as unknown) as { id?: unknown }).id; return uid != null ? parseInt(String(uid), 10) : null })(),
          patiscoDocId: shipment.patiscoDocId ?? undefined,
          patiscoDocNo: shipment.patiscoDocNo ?? undefined,
        },
      })
      confirmed++
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }

  return NextResponse.json({ ok: true, confirmed, skipped })
}
