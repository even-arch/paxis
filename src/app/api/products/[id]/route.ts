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

  const product = await prisma.pRD_Product.findUnique({
    where: { id: Number(params.id) },
    include: {
      inventoryItems: true,
      supplierProducts: {
        include: { supplier: { select: { id: true, name: true, shortName: true } } },
      },
    },
  })

  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(product, {
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function PUT(req: NextRequest, {
  params }: Params) {
  const prisma = await getRequestPrisma()
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const product = await prisma.pRD_Product.update({
    where: { id: Number(params.id) },
    data: {
      name: body.name,
      sku: body.sku || null,
      modelNo: body.modelNo || null,
      description: body.description || null,
      specification: body.specification || null,
      unitPerInner: body.unitPerInner ? Number(body.unitPerInner) : null,
      unitPerCarton: body.unitPerCarton ? Number(body.unitPerCarton) : null,
      cbm: body.cbm ? String(body.cbm) : null,
      grossWeight: body.grossWeight ? String(body.grossWeight) : null,
      netWeight: body.netWeight ? String(body.netWeight) : null,
      length: body.length ? String(body.length) : null,
      width: body.width ? String(body.width) : null,
      height: body.height ? String(body.height) : null,
      htsCode: body.htsCode || null,
      countryOfOrigin: body.countryOfOrigin || null,
      unit: body.unit || null,
      isMadeToOrder: Boolean(body.isMadeToOrder),
      safetyStock: body.safetyStock ? Number(body.safetyStock) : 0,
    },
  })

  return NextResponse.json(product)
}

export async function DELETE(_req: NextRequest, {
  params }: Params) {
  const prisma = await getRequestPrisma()
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 軟刪除
  await prisma.pRD_Product.update({
    where: { id: Number(params.id) },
    data: { isActive: false },
  })

  return NextResponse.json({ ok: true })
}
