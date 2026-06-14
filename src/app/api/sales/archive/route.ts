import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// POST /api/sales/archive
// body: { ids: number[], action: 'archive' | 'unarchive' }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { ids, action } = body as { ids: number[]; action: 'archive' | 'unarchive' }

  if (!ids?.length) return NextResponse.json({ error: '請選擇至少一張單據' }, { status: 400 })

  const archivedAt = action === 'archive' ? new Date() : null

  const result = await prisma.sLS_Order.updateMany({
    where: { id: { in: ids } },
    data: { archivedAt },
  })

  return NextResponse.json({ updated: result.count })
}
