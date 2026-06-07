import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

type Params = { params: { id: string } }

interface PIItem {
  slsItemId: number
  quantity: number
}

export async function POST(req: NextRequest, {
  params }: Params) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = parseInt((session.user as { id?: string })?.id ?? '', 10)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orderId = Number(params.id)
  const body = await req.json() as {
    piNo?: string | null             // 外部傳入（AI 匯入），否則自動產生
    estimatedShipDate?: string | null
    note?: string | null
    source?: string | null           // 'MANUAL' | 'AI_IMPORT'，預設 MANUAL
    items: PIItem[]
  }

  if (!body.items?.length) {
    return NextResponse.json({ error: '至少需要一項品項' }, { status: 400 })
  }

  const order = await prisma.sLS_Order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.status === 4 || order.status === 5) {
    return NextResponse.json({ error: '此訂單已完成或取消，無法發出 PI' }, { status: 400 })
  }

  // PI 號：優先用傳入值（AI 匯入時帶入文件原始號碼），否則自動產生
  let piNo = body.piNo?.trim() || null
  if (!piNo) {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const count = await prisma.sLS_PI.count()
    piNo = `PI-${datePart}-${String(count + 1).padStart(4, '0')}`
  }

  const sourceLabel = body.source ?? 'MANUAL'

  // 建立 PI
  const now = new Date()

  const pi = await prisma.sLS_PI.create({
    data: {
      orderId,
      piNo,
      estimatedShipDate: body.estimatedShipDate ? new Date(body.estimatedShipDate) : null,
      status: 0,
      source: sourceLabel,
      performedBy: userId,
      performedAt: now,
      items: {
        create: body.items.map(i => ({
          slsItemId: i.slsItemId,
          quantity: i.quantity,
        })),
      },
    },
  })

  // 更新 reservedQty + 寫 INV_Movement type=2（預留）
  for (const piItem of body.items) {
    const orderItem = order.items.find(i => i.id === piItem.slsItemId)
    if (!orderItem) continue

    const stock = await prisma.iNV_Stock.upsert({
      where: { productId: orderItem.productId },
      create: {
        productId: orderItem.productId,
        quantity: 0,
        reservedQty: piItem.quantity,
        safetyStock: 0,
      },
      update: {
        reservedQty: { increment: piItem.quantity },
      },
    })

    await prisma.iNV_Movement.create({
      data: {
        productId: orderItem.productId,
        type: 2,
        qtyDelta: 0,
        reservedDelta: piItem.quantity,
        quantityAfter: stock.quantity,
        reservedAfter: stock.reservedQty,
        slsPiId: pi.id,
        source: sourceLabel,
        performedBy: userId,
        performedAt: now,
        note: `預留 ${piNo}`,
      },
    })
  }

  // 更新訂單狀態為「PI 已發出」
  await prisma.sLS_Order.update({
    where: { id: orderId },
    data: { status: 2 },
  })

  return NextResponse.json({ ok: true, piNo, piId: pi.id }, { status: 201 })
}
