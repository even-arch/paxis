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

export async function DELETE(req: NextRequest, {
  params }: Params) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const itemId = Number(searchParams.get('itemId'))

  await prisma.pO_Item.delete({ where: { id: itemId } })
  return NextResponse.json({ ok: true })
}
