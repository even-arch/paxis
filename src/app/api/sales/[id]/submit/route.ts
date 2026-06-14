import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

type Params = { params: { id: string } }

export async function POST(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  const order = await prisma.sLS_Order.findUnique({
    where: { id },
    include: { items: { select: { id: true } } },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.status !== 0) return NextResponse.json({ error: '只有草稿可以送出' }, { status: 400 })
  if (order.items.length === 0)
    return NextResponse.json({ error: '訂單沒有品項，無法送出' }, { status: 400 })

  await prisma.sLS_Order.update({ where: { id }, data: { status: 1 } })
  return NextResponse.json({ ok: true })
}
