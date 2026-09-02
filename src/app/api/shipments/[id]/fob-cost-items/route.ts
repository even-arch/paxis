/**
 * GET  /api/shipments/[id]/fob-cost-items  — 列出此出貨單的所有貨代費用項目
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = Number(params.id)
  if (isNaN(shipmentId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const items = await prisma.sLS_FobCostItem.findMany({
    where: { shipmentId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, amountTWD: true, note: true, createdAt: true },
  })

  const total = items.reduce((sum, i) => sum + Number(i.amountTWD), 0)

  return NextResponse.json({
    items: items.map(i => ({ ...i, amountTWD: Number(i.amountTWD) })),
    totalTWD: total,
  })
}
