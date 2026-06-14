import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, {
  params }: Params) {
  const prisma = await getRequestPrisma()
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const order = await prisma.sLS_Order.findUnique({
    where: { id: Number(params.id) },
    include: {
      customer: true,
      creator: { select: { name: true } },
      performer: { select: { name: true } },
      items: {
        include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
      },
      pis: {
        include: { items: true },
        orderBy: { performedAt: 'desc' },
      },
    },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}

export async function PATCH(req: NextRequest, {
  params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  const body = await req.json() as {
    currencyCode?: string
    exchangeRate?: number | string
    note?: string | null
    customerRequestedShipDate?: string | null
  }

  const data: Record<string, unknown> = {}
  if (body.currencyCode !== undefined) data.currencyCode = body.currencyCode
  if (body.exchangeRate !== undefined) data.exchangeRate = String(body.exchangeRate)
  if (body.note !== undefined) data.note = body.note ?? null
  if (body.customerRequestedShipDate !== undefined)
    data.customerRequestedShipDate = body.customerRequestedShipDate ? new Date(body.customerRequestedShipDate) : null

  const order = await prisma.sLS_Order.update({ where: { id }, data })
  return NextResponse.json({ ok: true, order })
}

export async function DELETE(_req: NextRequest, {
  params }: Params) {
  const prisma = await getRequestPrisma()
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  const order = await prisma.sLS_Order.findUnique({
    where: { id },
    include: { pis: { select: { id: true } } },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (order.pis.length > 0) {
    return NextResponse.json({ error: '此訂單已有 PI，無法刪除' }, { status: 400 })
  }

  await prisma.sLS_Item.deleteMany({ where: { orderId: id } })
  await prisma.sLS_Order.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
