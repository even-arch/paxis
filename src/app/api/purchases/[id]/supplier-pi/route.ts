import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, {
  params }: Params) {
  const prisma = await getRequestPrisma()
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = parseInt((session.user as { id?: string })?.id ?? '', 10)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orderId = Number(params.id)
  const body = await req.json() as {
    piNo: string
    estimatedShipDate?: string | null
    note?: string | null
    items: { poItemId: number; confirmedQty: number }[]
  }

  if (!body.piNo?.trim()) {
    return NextResponse.json({ error: '供應商 PI 單號為必填' }, { status: 400 })
  }

  const order = await prisma.pO.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.status === 3 || order.status === 4) {
    return NextResponse.json({ error: '供應商訂單已完成或取消' }, { status: 400 })
  }

  const supplierPI = await prisma.pI_SupplierCopy.create({
    data: {
      orderId,
      piNo: body.piNo.trim(),
      estimatedShipDate: body.estimatedShipDate ? new Date(body.estimatedShipDate) : null,
      note: body.note ?? null,
      source: 'MANUAL',
      performedBy: userId,
      performedAt: new Date(),
      items: {
        create: (body.items ?? [])
          .filter(i => i.confirmedQty > 0)
          .map(i => ({ poItemId: i.poItemId, confirmedQty: i.confirmedQty })),
      },
    },
  })

  return NextResponse.json({ ok: true, supplierPIId: supplierPI.id }, { status: 201 })
}

export async function GET(_req: NextRequest, {
  params }: Params) {
  const prisma = await getRequestPrisma()
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pis = await prisma.pI_SupplierCopy.findMany({
    where: { orderId: Number(params.id) },
    include: {
      items: { include: { poItem: { include: { product: { select: { name: true, sku: true } } } } } },
      performer: { select: { name: true } },
    },
    orderBy: { performedAt: 'desc' },
  })

  return NextResponse.json(pis)
}
