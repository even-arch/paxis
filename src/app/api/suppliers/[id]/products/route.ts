import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

type Params = { params: { id: string } }

/** 新增供應商與商品的對應關係 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const supplierId = Number(params.id)

  const record = await prisma.sUP_SupplierProduct.upsert({
    where: { supplierId_productId: { supplierId, productId: Number(body.productId) } },
    create: {
      supplierId,
      productId: Number(body.productId),
      supplierSku: body.supplierSku || null,
      unitPrice: body.unitPrice ? String(body.unitPrice) : null,
      currencyCode: body.currencyCode || null,
      moq: body.moq ? Number(body.moq) : null,
      leadTimeDays: body.leadTimeDays ? Number(body.leadTimeDays) : null,
      isPreferred: Boolean(body.isPreferred),
      note: body.note || null,
    },
    update: {
      supplierSku: body.supplierSku || null,
      unitPrice: body.unitPrice ? String(body.unitPrice) : null,
      currencyCode: body.currencyCode || null,
      moq: body.moq ? Number(body.moq) : null,
      leadTimeDays: body.leadTimeDays ? Number(body.leadTimeDays) : null,
      isPreferred: Boolean(body.isPreferred),
      note: body.note || null,
    },
  })

  // 如果設為主要供應商，取消同商品的其他主要供應商
  if (body.isPreferred) {
    await prisma.sUP_SupplierProduct.updateMany({
      where: {
        productId: Number(body.productId),
        supplierId: { not: supplierId },
      },
      data: { isPreferred: false },
    })
  }

  return NextResponse.json(record, { status: 201 })
}

/** 移除供應商與商品的對應 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const productId = Number(searchParams.get('productId'))

  await prisma.sUP_SupplierProduct.delete({
    where: {
      supplierId_productId: { supplierId: Number(params.id), productId },
    },
  })

  return NextResponse.json({ ok: true })
}
