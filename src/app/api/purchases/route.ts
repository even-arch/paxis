import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generatePoNo } from '@/lib/utils'

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status')
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limit = 20

  const where: Record<string, unknown> = {}
  if (status !== null && status !== '') where.status = Number(status)
  if (search) {
    where.OR = [
      { poNo: { contains: search } },
      { patiscoOrderNo: { contains: search } },
      { supplier: { name: { contains: search } } },
    ]
  }

  const [total, orders] = await Promise.all([
    prisma.pO_Order.count({ where }),
    prisma.pO_Order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        supplier: { select: { id: true, name: true, shortName: true } },
        _count: { select: { items: true } },
      },
    }),
  ])

  return NextResponse.json({ orders, total, page, totalPages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const order = await prisma.pO_Order.create({
    data: {
      poNo: body.poNo?.trim() || generatePoNo(),
      supplierId: Number(body.supplierId),
      salesOrderId: body.salesOrderId ? Number(body.salesOrderId) : null,
      status: 0,
      sourceType: body.sourceType !== undefined ? Number(body.sourceType) : 0,
      currencyCode: body.currencyCode,
      exchangeRate: String(body.exchangeRate || '1'),
      totalAmount: body.totalAmount ? String(body.totalAmount) : null,
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
      port: body.port || null,
      shipVia: body.shipVia || null,
      note: body.note || null,
      patiscoOrderNo: body.patiscoOrderNo || null,
      patiscoOrderId: body.patiscoOrderId ? String(body.patiscoOrderId) : null,
      createdBy: Number(session.user.id),
      // 明細
      items: body.items?.length
        ? {
            create: body.items.map((item: {
              productId: number; quantity: number; unitPrice: number; unit?: string; note?: string
            }) => ({
              productId: Number(item.productId),
              quantity: Number(item.quantity),
              unitPrice: String(item.unitPrice),
              unit: item.unit || null,
              note: item.note || null,
            })),
          }
        : undefined,
    },
    include: { items: true },
  })

  return NextResponse.json(order, { status: 201 })
}
