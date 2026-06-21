import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids, action } = await req.json() as { ids: number[]; action: 'archive' | 'unarchive' }
  if (!ids?.length) return NextResponse.json({ error: '請選擇至少一筆' }, { status: 400 })

  const prisma = await getRequestPrisma()
  const result = await prisma.pI.updateMany({
    where: { id: { in: ids } },
    data: { archivedAt: action === 'archive' ? new Date() : null },
  })
  return NextResponse.json({ updated: result.count })
}
