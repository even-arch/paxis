// POST /api/webhooks/pos — POS 系統推送銷售/退貨事件
// 驗證通過後，扣減或回補庫存並寫入 INV_Movement
import { NextRequest, NextResponse } from 'next/server'
import { getRequestPrisma } from '@/lib/request-db'
import { verifyPosSignature } from '@/lib/posAuth'

interface PosEvent {
  event: 'sale' | 'return'
  posOrderId: string
  items: Array<{
    sku: string
    quantity: number
  }>
}

export async function POST(req: NextRequest) {
  const prisma = await getRequestPrisma()
    const rawBody = await req.text()

  if (!verifyPosSignature(req, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: PosEvent
  try {
    body = JSON.parse(rawBody) as PosEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.event || !['sale', 'return'].includes(body.event)) {
    return NextResponse.json({ error: 'Unknown event type' }, { status: 400 })
  }

  const results = []
  const isSale = body.event === 'sale'

  for (const item of body.items ?? []) {
    const product = await prisma.pRD_Product.findUnique({
      where: { sku: item.sku },
      select: { id: true, name: true },
    })

    if (!product) {
      results.push({ sku: item.sku, ok: false, reason: 'Product not found' })
      continue
    }

    const stock = await prisma.iNV_Stock.findUnique({ where: { productId: product.id } })

    if (isSale && (!stock || stock.quantity - stock.reservedQty < item.quantity)) {
      results.push({ sku: item.sku, ok: false, reason: 'Insufficient available stock' })
      continue
    }

    const delta = isSale ? -item.quantity : item.quantity

    const updated = await prisma.iNV_Stock.upsert({
      where: { productId: product.id },
      create: { productId: product.id, quantity: Math.max(0, delta), reservedQty: 0, safetyStock: 0 },
      update: { quantity: { increment: delta } },
    })

    await prisma.iNV_Movement.create({
      data: {
        productId: product.id,
        type: isSale ? 8 : 9, // 8 = POS 銷售出庫, 9 = POS 退貨入庫
        qtyDelta: delta,
        reservedDelta: 0,
        quantityAfter: updated.quantity,
        reservedAfter: updated.reservedQty,
        patiscoDocType: 'POS_EVENT',
        patiscoDocNo: body.posOrderId,
        note: `POS ${isSale ? '銷售' : '退貨'} ${body.posOrderId}`,
      },
    })

    results.push({ sku: item.sku, ok: true, quantityAfter: updated.quantity })
  }

  return NextResponse.json({ ok: true, results })
}
