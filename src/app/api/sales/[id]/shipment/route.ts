import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Decimal } from '@prisma/client/runtime/library'

type Params = { params: { id: string } }

interface ShipItem {
  slsItemId: number
  quantity: number
  cartons?: number | null
  grossWeightKg?: number | null
  netWeightKg?: number | null
  cbm?: number | null
}

export async function POST(req: NextRequest, {
  params }: Params) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = parseInt((session.user as { id?: string })?.id ?? '', 10)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orderId = Number(params.id)
  const body = await req.json() as {
    piId?: number | null
    actualShipDate: string   // 實際離港日，必填
    shippingMethod?: string | null
    portOfLoading?: string | null
    portOfDischarge?: string | null
    trackingNo?: string | null
    packingListNo?: string | null
    commercialInvNo?: string | null
    note?: string | null
    items: ShipItem[]
  }

  if (!body.actualShipDate) {
    return NextResponse.json({ error: '實際出貨日為必填' }, { status: 400 })
  }
  if (!body.items?.length) {
    return NextResponse.json({ error: '至少需要一項品項' }, { status: 400 })
  }

  const order = await prisma.sLS_Order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.status === 4 || order.status === 5) {
    return NextResponse.json({ error: '此訂單已完成或取消' }, { status: 400 })
  }

  // 若有指定 PI，驗證它屬於此訂單且有效
  if (body.piId) {
    const pi = await prisma.sLS_PI.findUnique({ where: { id: body.piId } })
    if (!pi || pi.orderId !== orderId || pi.status !== 0) {
      return NextResponse.json({ error: '指定的 PI 無效或已取消' }, { status: 400 })
    }
  }

  // 產生出貨單號：SHP-YYYYMMDD-XXXX
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const count = await prisma.sLS_Shipment.count()
  const shipmentNo = `SHP-${datePart}-${String(count + 1).padStart(4, '0')}`

  const now = new Date()
  const actualShipDate = new Date(body.actualShipDate)

  const shipment = await prisma.sLS_Shipment.create({
    data: {
      orderId,
      piId: body.piId ?? null,
      shipmentNo,
      actualShipDate,
      shippingMethod: body.shippingMethod ?? null,
      portOfLoading: body.portOfLoading ?? null,
      portOfDischarge: body.portOfDischarge ?? null,
      trackingNo: body.trackingNo ?? null,
      packingListNo: body.packingListNo ?? null,
      commercialInvNo: body.commercialInvNo ?? null,
      note: body.note ?? null,
      source: 'MANUAL',
      performedBy: userId,
      performedAt: now,
      items: {
        create: body.items.map(i => ({
          slsItemId: i.slsItemId,
          quantity: i.quantity,
          cartons: i.cartons ?? null,
          grossWeightKg: i.grossWeightKg != null ? String(i.grossWeightKg) : null,
          netWeightKg: i.netWeightKg != null ? String(i.netWeightKg) : null,
          cbm: i.cbm != null ? String(i.cbm) : null,
        })),
      },
    },
  })

  // 更新庫存：quantity--, reservedQty--（若有 PI 才扣 reserved）
  const hasPi = !!body.piId

  for (const shipItem of body.items) {
    const orderItem = order.items.find(i => i.id === shipItem.slsItemId)
    if (!orderItem) continue

    const stock = await prisma.iNV_Stock.update({
      where: { productId: orderItem.productId },
      data: {
        quantity: { decrement: shipItem.quantity },
        ...(hasPi ? { reservedQty: { decrement: shipItem.quantity } } : {}),
      },
    })

    await prisma.iNV_Movement.create({
      data: {
        productId: orderItem.productId,
        type: 4,
        qtyDelta: -shipItem.quantity,
        reservedDelta: hasPi ? -shipItem.quantity : 0,
        quantityAfter: stock.quantity,
        reservedAfter: stock.reservedQty,
        slsShipmentId: shipment.id,
        source: 'MANUAL',
        performedBy: userId,
        performedAt: now,
        note: `出倉 ${shipmentNo}`,
      },
    })

    // 更新 SLS_Item 的已出貨數量
    await prisma.sLS_Item.update({
      where: { id: shipItem.slsItemId },
      data: { shippedQty: { increment: shipItem.quantity } },
    })
  }

  // 更新訂單狀態
  const updatedItems = await prisma.sLS_Item.findMany({ where: { orderId } })
  const allShipped = updatedItems.every(i => i.shippedQty >= i.quantity)
  const anyShipped = updatedItems.some(i => i.shippedQty > 0)

  await prisma.sLS_Order.update({
    where: { id: orderId },
    data: { status: allShipped ? 4 : anyShipped ? 3 : order.status },
  })

  // 自動建立應收帳款
  const shipAmountForeign = body.items.reduce((sum, shipItem) => {
    const orderItem = order.items.find(i => i.id === shipItem.slsItemId)
    if (!orderItem) return sum
    return sum.add(new Decimal(shipItem.quantity).mul(orderItem.unitPrice))
  }, new Decimal(0))

  const exchangeRate = new Decimal(order.exchangeRate || '1')
  const amountTWD = shipAmountForeign.mul(exchangeRate)

  const customer = order.customerId
    ? await prisma.cUS_Customer.findUnique({
        where: { id: order.customerId },
        select: { collectionCycleDays: true },
      })
    : null
  const dueDate = customer?.collectionCycleDays
    ? new Date(Date.now() + customer.collectionCycleDays * 86400000)
    : null

  await prisma.fIN_Receivable.create({
    data: {
      customerId: order.customerId ?? null,
      customerName: order.patiscoBuyerName ?? null,
      shipmentId: shipment.id,
      currencyCode: order.currencyCode,
      amountForeign: shipAmountForeign,
      rateAtInvoice: exchangeRate,
      amountTWD,
      dueDate,
      status: 0,
    },
  })

  return NextResponse.json({ ok: true, shipmentNo, shipmentId: shipment.id }, { status: 201 })
}
