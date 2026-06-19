import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const prisma = await getRequestPrisma()
  const alerts = await prisma.sYS_DataAlert.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ alerts })
}
