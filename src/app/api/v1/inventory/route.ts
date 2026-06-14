// GET /api/v1/inventory — POS 系統查詢所有庫存水位
import { NextRequest, NextResponse } from 'next/server'
import { getRequestPrisma } from '@/lib/request-db'
import { verifyPosApiKey } from '@/lib/posAuth'

export async function GET(req: NextRequest) {
  const prisma = await getRequestPrisma()
    if (!verifyPosApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stocks = await prisma.iNV_Stock.findMany({
    include: {
      product: {
        select: { id: true, name: true, sku: true, isAvailableForPos: true, posProductId: true },
      },
    },
  })

  const data = stocks
    .filter(s => s.product.isAvailableForPos)
    .map(s => ({
      productId: s.productId,
      sku: s.product.sku,
      name: s.product.name,
      posProductId: s.product.posProductId,
      quantity: s.quantity,
      reservedQty: s.reservedQty,
      availableQty: s.quantity - s.reservedQty,
    }))

  return NextResponse.json({ data, total: data.length, updatedAt: new Date().toISOString() })
}
