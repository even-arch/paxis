import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notifyInventoryUpdate } from '@/api/patisco/client'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const orderId = Number(params.id)

  const order = await prisma.pO_Order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.status === 3 || order.status === 4)
    return NextResponse.json({ error: '此採購單已完成或取消' }, { status: 400 })

  const receiveItems: Array<{ poItemId: number; quantity: number }> = body.items ?? []
  if (receiveItems.length === 0)
    return NextResponse.json({ error: '請輸入入庫數量' }, { status: 400 })

  const receiptNo = `RCV-${order.poNo}-${Date.now().toString().slice(-4)}`

  const receipt = await prisma.pO_Receipt.create({
    data: {
      orderId,
      receiptNo,
      note: body.note || null,
      items: {
        create: receiveItems.map(i => ({
          poItemId: i.poItemId,
          quantity: i.quantity,
        })),
      },
    },
  })

  const patiscoNotifications: Array<Promise<unknown>> = []

  for (const item of receiveItems) {
    const poItem = order.items.find(i => i.id === item.poItemId)
    if (!poItem) continue

    await prisma.pO_Item.update({
      where: { id: item.poItemId },
      data: { receivedQty: { increment: item.quantity } },
    })

    // 更新庫存（type=1 入庫）
    const stock = await prisma.iNV_Stock.upsert({
      where: { productId: poItem.productId },
      create: {
        productId: poItem.productId,
        quantity: item.quantity,
        reservedQty: 0,
        safetyStock: 0,
      },
      update: { quantity: { increment: item.quantity } },
    })

    // 寫異動紀錄（新 schema）
    await prisma.iNV_Movement.create({
      data: {
        productId: poItem.productId,
        type: 1,
        qtyDelta: item.quantity,
        reservedDelta: 0,
        quantityAfter: stock.quantity,
        reservedAfter: stock.reservedQty,
        receiptId: receipt.id,
        note: `入庫 ${receiptNo}`,
      },
    })

    if (poItem.product.patiscoProductId) {
      patiscoNotifications.push(
        notifyInventoryUpdate({
          productId: poItem.productId,
          patiscoProductId: poItem.product.patiscoProductId,
          quantity: stock.quantity,
        }).catch(() => {})
      )
    }
  }

  // 更新採購單狀態
  const updatedItems = await prisma.pO_Item.findMany({ where: { orderId } })
  const allReceived = updatedItems.every(i => i.receivedQty >= i.quantity)
  const anyReceived = updatedItems.some(i => i.receivedQty > 0)

  await prisma.pO_Order.update({
    where: { id: orderId },
    data: {
      status: allReceived ? 3 : anyReceived ? 2 : order.status,
      arrivedDate: allReceived ? new Date() : undefined,
    },
  })

  Promise.all(patiscoNotifications).catch(() => {})

  return NextResponse.json({ ok: true, receiptNo, receiptId: receipt.id })
}
