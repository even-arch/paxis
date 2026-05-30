import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

type Params = { params: { productId: string } }

/**
 * 手動庫存調整
 * type 3 = 手動調整, type 4 = 盤點調整
 * quantity: 正數=入庫, 負數=出庫
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const productId = Number(params.productId)
  const qty = Number(body.quantity)
  const type = Number(body.type) || 3

  if (isNaN(qty) || qty === 0) {
    return NextResponse.json({ error: '請輸入有效的調整數量' }, { status: 400 })
  }

  const stock = await prisma.iNV_Stock.upsert({
    where: { productId },
    create: { productId, quantity: Math.max(0, qty), reservedQty: 0, safetyStock: 0 },
    update: { quantity: { increment: qty } },
  })

  // 確保不低於 0
  const finalQty = Math.max(0, stock.quantity)
  if (stock.quantity < 0) {
    await prisma.iNV_Stock.update({ where: { productId }, data: { quantity: 0 } })
  }

  await prisma.iNV_Movement.create({
    data: {
      productId,
      type,
      qtyDelta: qty,
      reservedDelta: 0,
      quantityAfter: finalQty,
      reservedAfter: stock.reservedQty,
      note: body.note || (type === 4 ? '盤點調整' : '手動調整'),
    },
  })

  return NextResponse.json({ ok: true, quantity: finalQty })
}
