import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orderId = Number(params.id)
  const order = await prisma.sLS_Order.findUnique({ where: { id: orderId } })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const item = await prisma.sLS_Item.create({
    data: {
      orderId,
      productId: Number(body.productId),
      quantity:  Number(body.quantity),
      unitPrice: String(body.unitPrice),
      unit:      body.unit || null,
      note:      body.note || null,
    },
    include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
  })
  return NextResponse.json(item, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orderId = Number(params.id)
  const { searchParams } = new URL(req.url)
  const itemId = Number(searchParams.get('itemId'))

  const item = await prisma.sLS_Item.findUnique({ where: { id: itemId } })
  if (!item || item.orderId !== orderId)
    return NextResponse.json({ error: '品項不屬於此訂單' }, { status: 400 })

  const body = await req.json()
  const updated = await prisma.sLS_Item.update({
    where: { id: itemId },
    data: {
      quantity:  body.quantity  !== undefined ? Number(body.quantity)  : undefined,
      unitPrice: body.unitPrice !== undefined ? String(body.unitPrice) : undefined,
      unit:      body.unit      !== undefined ? (body.unit || null)    : undefined,
      note:      body.note      !== undefined ? (body.note || null)    : undefined,
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const itemId = Number(searchParams.get('itemId'))
  if (!itemId) return NextResponse.json({ error: '缺少 itemId' }, { status: 400 })

  const item = await prisma.sLS_Item.findUnique({
    where: { id: itemId },
    include: { piItems: { select: { id: true } } },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (Number(params.id) !== item.orderId)
    return NextResponse.json({ error: '品項不屬於此訂單' }, { status: 400 })

  // 若已列入 PI，先刪 PI 品項再刪本品項（cascade 處理）
  if (item.piItems.length > 0) {
    await prisma.sLS_PIItem.deleteMany({ where: { slsItemId: itemId } })
  }

  await prisma.sLS_Item.delete({ where: { id: itemId } })
  return NextResponse.json({ ok: true })
}
