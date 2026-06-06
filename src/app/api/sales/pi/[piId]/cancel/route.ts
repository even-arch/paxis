import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

type Params = { params: { piId: string } }

export async function POST(req: NextRequest, {
  params }: Params) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = parseInt((session.user as { id?: string })?.id ?? '', 10)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const piId = Number(params.piId)
  const body = await req.json() as { reason?: string }

  const pi = await prisma.sLS_PI.findUnique({
    where: { id: piId },
    include: {
      items: { include: { slsItem: { include: { product: true } } } },
      order: { include: { pis: { where: { status: 0 } } } },
    },
  })

  if (!pi) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (pi.status === 1) return NextResponse.json({ error: 'PI 已取消' }, { status: 400 })

  const now = new Date()

  // 取消 PI
  await prisma.sLS_PI.update({
    where: { id: piId },
    data: {
      status: 1,
      cancelledAt: now,
      cancelReason: body.reason ?? null,
    },
  })

  // 釋放預留：reservedQty--，寫 INV_Movement type=3
  for (const piItem of pi.items) {
    const productId = piItem.slsItem.productId

    const stock = await prisma.iNV_Stock.update({
      where: { productId },
      data: { reservedQty: { decrement: piItem.quantity } },
    })

    await prisma.iNV_Movement.create({
      data: {
        productId,
        type: 3,
        qtyDelta: 0,
        reservedDelta: -piItem.quantity,
        quantityAfter: stock.quantity,
        reservedAfter: stock.reservedQty,
        slsPiId: piId,
        source: 'MANUAL',
        performedBy: userId,
        performedAt: now,
        note: `取消預留 ${pi.piNo}${body.reason ? `：${body.reason}` : ''}`,
      },
    })
  }

  // 若此訂單已無有效 PI，訂單狀態退回「已確認」
  const activePiCount = pi.order.pis.length - 1 // 扣掉剛取消這筆
  if (activePiCount <= 0) {
    await prisma.sLS_Order.update({
      where: { id: pi.orderId },
      data: { status: 1 },
    })
  }

  return NextResponse.json({ ok: true })
}
