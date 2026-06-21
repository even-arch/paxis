import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json([])

  const prisma = await getRequestPrisma()

  const pis = await prisma.pI.findMany({
    where: {
      archivedAt: null,
      status: 0,
      OR: [
        { piNo: { contains: q } },
        { customer: { name: { contains: q } } },
        { customer: { shortName: { contains: q } } },
      ],
    },
    select: {
      id: true,
      piNo: true,
      totalAmount: true,
      currencyCode: true,
      customer: { select: { name: true, shortName: true } },
    },
    orderBy: { piNo: 'asc' },
    take: 20,
  })

  return NextResponse.json(pis.map(p => ({
    ...p,
    totalAmount: p.totalAmount?.toString() ?? null,
  })))
}
