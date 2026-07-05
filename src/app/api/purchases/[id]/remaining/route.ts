import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const poId = Number(params.id)
  if (isNaN(poId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  try {
    const po = await prisma.pO.findUnique({
      where: { id: poId },
      select: { id: true, poNo: true, items: { select: { id: true, quantity: true, product: { select: { id: true } } } } },
    })

    if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // 查詢該 PO 在所有已提交的通知單中已通知了多少
    const notifiedItems = await prisma.pO_ShippingNoticeItem.findMany({
      where: {
        poId,
        notice: {
          status: { not: 'DRAFT' }, // 只計算已提交的通知單
        },
      },
      select: { productId: true, notifiedQuantity: true },
    })

    // 計算已通知量（按產品彙總）
    const notifiedByProduct = new Map<number, number>()
    for (const item of notifiedItems) {
      const current = notifiedByProduct.get(item.productId) || 0
      notifiedByProduct.set(item.productId, current + item.notifiedQuantity)
    }

    // 計算剩餘量（按產品）
    const remaining = po.items.map(it => ({
      productId: it.product.id,
      originalQuantity: it.quantity,
      notifiedQuantity: notifiedByProduct.get(it.product.id) || 0,
      remainingQuantity: it.quantity - (notifiedByProduct.get(it.product.id) || 0),
    }))

    const totalOriginal = po.items.reduce((sum, it) => sum + it.quantity, 0)
    const totalNotified = Array.from(notifiedByProduct.values()).reduce((sum, qty) => sum + qty, 0)
    const totalRemaining = totalOriginal - totalNotified

    return NextResponse.json({
      poId,
      poNo: po.poNo,
      totalOriginal,
      totalNotified,
      totalRemaining,
      byProduct: remaining,
      notificationHistory: notifiedItems, // 用於詳情頁顯示
    })
  } catch (err) {
    console.error('[purchases remaining]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
