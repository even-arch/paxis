import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function GET(req: NextRequest) {
  const prisma = await getRequestPrisma()
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limitParam = Number(searchParams.get('limit') ?? 20)
  const limit = Math.min(limitParam, 2000)

  const where = search
    ? {
        isActive: true,
        OR: [
          { name: { contains: search } },
          { sku: { contains: search } },
          { modelNo: { contains: search } },
        ],
      }
    : { isActive: true }

  const [total, products] = await Promise.all([
    prisma.pRD_Product.count({ where }),
    prisma.pRD_Product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        sku: true,
        modelNo: true,
        unit: true,
        htsCode: true,
        countryOfOrigin: true,
        isActive: true,
        createdAt: true,
        inventoryItems: { select: { quantity: true } },
      },
    }),
  ])

  return NextResponse.json({ products, total, page, totalPages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const prisma = await getRequestPrisma()
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const product = await prisma.pRD_Product.create({
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

  // 初始化庫存紀錄
  await prisma.iNV_Stock.create({
    data: { productId: product.id, quantity: 0, reservedQty: 0, safetyStock: 0 },
  })

  return NextResponse.json(product, { status: 201 })
}
