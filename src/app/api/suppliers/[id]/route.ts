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

  const supplier = await prisma.sUP_Supplier.findUnique({
    where: { id: Number(params.id) },
    include: {
      contacts: true,
      products: {
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
        },
        orderBy: { isPreferred: 'desc' },
      },
    },
  })

  if (!supplier) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(supplier)
}

export async function PUT(req: NextRequest, {
  params }: Params) {
  const prisma = await getRequestPrisma()
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const supplier = await prisma.sUP_Supplier.update({
    where: { id: Number(params.id) },
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
      defaultTradeTerms: body.defaultTradeTerms || null,
      note: body.note || null,
      chargeTemplateId: body.chargeTemplateId ? Number(body.chargeTemplateId) : null,
    },
  })

  return NextResponse.json(supplier)
}

export async function DELETE(_req: NextRequest, {
  params }: Params) {
  const prisma = await getRequestPrisma()
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.sUP_Supplier.update({
    where: { id: Number(params.id) },
    data: { isActive: false },
  })

  return NextResponse.json({ ok: true })
}
