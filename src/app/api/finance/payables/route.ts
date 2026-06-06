import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // '0' | '1' | '2' | null (all)
  const supplierId = searchParams.get('supplierId')

  const where: Record<string, unknown> = {}
  if (status !== null && status !== '') where.status = Number(status)
  if (supplierId) where.supplierId = Number(supplierId)

  const payables = await prisma.fIN_Payable.findMany({
    where,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    include: {
      supplier: { select: { id: true, name: true, shortName: true } },
      receipt: {
        select: {
          receiptNo: true, performedAt: true,
          order: { select: { id: true, poNo: true } },
        },
      },
    },
  })

  return NextResponse.json(payables)
}
