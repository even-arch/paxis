import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const customerId = searchParams.get('customerId')

  const where: Record<string, unknown> = {}
  if (status !== null && status !== '') where.status = Number(status)
  if (customerId) where.customerId = Number(customerId)

  const receivables = await prisma.fIN_Receivable.findMany({
    where,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    include: {
      customer: { select: { id: true, name: true, shortName: true } },
      shipment: {
        select: {
          shipmentNo: true, actualShipDate: true,
          order: { select: { id: true, orderNo: true } },
        },
      },
    },
  })

  return NextResponse.json(receivables)
}
