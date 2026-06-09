import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, {
  params }: Params) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orderId = Number(params.id)
  const order = await prisma.pO_Order.findUnique({ where: { id: orderId } })
  if (!order || order.status !== 0)
    return NextResponse.json({ error: '只有草稿可以新增明細' }, { status: 400 })

  const body = await req.json()

  const item = await prisma.pO_Item.create({
    data: {
      orderId,
      productId: Number(body.productId),
      quantity: Number(body.quantity),
      unitPrice: String(body.unitPrice),
      unit: body.unit || null,
      note: body.note || null,
    },
    include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
  })

  return NextResponse.json(item, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orderId = Number(params.id)
  const order = await prisma.pO_Order.findUnique({ where: { id: orderId } })
  if (!order || order.status !== 0)
    return NextResponse.json({ error: '只有草稿可以修改明細' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const itemId = Number(searchParams.get('itemId'))
  const body = await req.json()

  const item = await prisma.pO_Item.update({
    where: { id: itemId },
    data: {
      quantity:  body.quantity  !== undefined ? Number(body.quantity)  : undefined,
      unitPrice: body.unitPrice !== undefined ? String(body.unitPrice) : undefined,
      unit:      body.unit      !== undefined ? (body.unit || null)    : undefined,
      note:      body.note      !== undefined ? (body.note || null)    : undefined,
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(req: NextRequest, {
  params }: Params) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orderId = Number(params.id)
  const { searchParams } = new URL(req.url)
  const itemId = Number(searchParams.get('itemId'))

  // 保護：只有草稿可以刪除品項
  const order = await prisma.pO_Order.findUnique({ where: { id: orderId } })
  if (!order || order.status !== 0)
    return NextResponse.json({ error: '只有草稿可以刪除品項' }, { status: 400 })

  await prisma.pO_Item.delete({ where: { id: itemId } })
  return NextResponse.json({ ok: true })
}
