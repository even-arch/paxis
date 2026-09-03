// GET /api/v1/products — POS 系統拉取產品目錄
// 回傳所有開放 POS 販售的產品，含目前庫存水位
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPosApiKey } from '@/lib/posAuth'

export async function GET(req: NextRequest) {
  if (!verifyPosApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const products = await prisma.pRD_Product.findMany({
    where: { isActive: true, isAvailableForPos: true },
    select: {
      id: true,
      name: true,
      sku: true,
      modelNo: true,
      unit: true,
      sellingPrice: true,
      posProductId: true,
      inventoryItems: {
        select: { quantity: true, reservedQty: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const data = products.map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    modelNo: p.modelNo,
    unit: p.unit,
    sellingPrice: p.sellingPrice,
    posProductId: p.posProductId,
    stock: {
      quantity: p.inventoryItems[0]?.quantity ?? 0,
      reservedQty: p.inventoryItems[0]?.reservedQty ?? 0,
      availableQty: (p.inventoryItems[0]?.quantity ?? 0) - (p.inventoryItems[0]?.reservedQty ?? 0),
    },
  }))

  return NextResponse.json({ data, total: data.length })
}
