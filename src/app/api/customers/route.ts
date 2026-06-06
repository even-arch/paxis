import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limitParam = Number(searchParams.get('limit') ?? 20)
  const limit = Math.min(limitParam, 1000)

  const where = search
    ? {
        isActive: true,
        OR: [
          { name: { contains: search } },
          { shortName: { contains: search } },
          { email: { contains: search } },
        ],
      }
    : { isActive: true }

  const [total, customers] = await Promise.all([
    prisma.cUS_Customer.count({ where }),
    prisma.cUS_Customer.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { salesOrders: true } },
      },
    }),
  ])

  return NextResponse.json({ customers, total, page, totalPages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const customer = await prisma.cUS_Customer.create({
    data: {
      name: body.name,
      shortName: body.shortName || null,
      address: body.address || null,
      city: body.city || null,
      countryCode: body.countryCode || null,
      postalCode: body.postalCode || null,
      phoneNo: body.phoneNo || null,
      fax: body.fax || null,
      email: body.email || null,
      contactPerson: body.contactPerson || null,
      taxId: body.taxId || null,
      paymentTerms: body.paymentTerms || null,
      currencyCode: body.currencyCode || null,
      patiscoBuyerId: body.patiscoBuyerId ? String(body.patiscoBuyerId) : null,
      note: body.note || null,
    },
  })

  return NextResponse.json(customer, { status: 201 })
}
