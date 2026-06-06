import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notifyPurchaseCreated } from '@/api/patisco/client'

type Params = { params: { id: string } }

/** 送出供應商訂單（草稿 → 已送出） */
export async function POST(_req: NextRequest, {
  params }: Params) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  const order = await prisma.pO_Order.findUnique({
    where: { id },
    include: { items: true },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.status !== 0) return NextResponse.json({ error: '只有草稿可以送出' }, { status: 400 })
  if (order.items.length === 0) return NextResponse.json({ error: '供應商訂單沒有明細' }, { status: 400 })

  const updated = await prisma.pO_Order.update({
    where: { id },
    data: { status: 1 },
  })

  // 非同步通知 Patisco（失敗不影響主流程）
  notifyPurchaseCreated({
    patiscoOrderId: order.patiscoOrderId ?? undefined,
    poNo: order.poNo,
    estimatedArrival: order.expectedDate?.toISOString().split('T')[0],
  }).catch(() => {})

  return NextResponse.json(updated)
}
