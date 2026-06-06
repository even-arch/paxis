// GET /api/v1/products/[sku] — POS 系統查詢單一產品
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPosApiKey } from '@/lib/posAuth'

type Params = { params: { sku: string } }

export async function GET(req: NextRequest, {
  params }: Params) {
    if (!verifyPosApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const product = await prisma.pRD_Product.findUnique({
    where: { sku: params.sku },
    select: {
      id: true, name: true, sku: true, modelNo: true,
      specification: true, unit: true, sellingPrice: true,
      posProductId: true, isAvailableForPos: true, isActive: true,
      inventoryItems: { select: { quantity: true, reservedQty: true, avgUnitCost: true } },
    },
  })

  if (!product || !product.isActive) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: product.id,
    name: product.name,
    sku: product.sku,
    modelNo: product.modelNo,
    specification: product.specification,
    unit: product.unit,
    sellingPrice: product.sellingPrice,
    posProductId: product.posProductId,
    isAvailableForPos: product.isAvailableForPos,
    stock: {
      quantity: product.inventoryItems[0]?.quantity ?? 0,
      reservedQty: product.inventoryItems[0]?.reservedQty ?? 0,
      availableQty: (product.inventoryItems[0]?.quantity ?? 0) - (product.inventoryItems[0]?.reservedQty ?? 0),
    },
  })
}
