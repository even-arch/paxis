import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, {
  params }: Params) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customer = await prisma.cUS_Customer.findUnique({
    where: { id: Number(params.id) },
    include: { contacts: true },
  })

  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(customer)
}

export async function PUT(req: NextRequest, {
  params }: Params) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const customer = await prisma.cUS_Customer.update({
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
      patiscoBuyerId: body.patiscoBuyerId ? String(body.patiscoBuyerId) : null,
      note: body.note || null,
    },
  })

  return NextResponse.json(customer)
}

export async function DELETE(_req: NextRequest, {
  params }: Params) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.cUS_Customer.update({
    where: { id: Number(params.id) },
    data: { isActive: false },
  })

  return NextResponse.json({ ok: true })
}
