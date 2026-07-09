import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = parseInt(params.id, 10)
  if (isNaN(shipmentId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await req.json() as { piIds?: number[] }
  const piIds = body.piIds
  if (!Array.isArray(piIds) || piIds.length === 0) {
    return NextResponse.json({ error: 'piIds 必填' }, { status: 400 })
  }

  await Promise.all(
    piIds.map((piId, idx) =>
      prisma.sLS_PI_Link.update({
        where: { shipmentId_piId: { shipmentId, piId } },
        data: { sortOrder: idx },
      })
    )
  )

  return NextResponse.json({ ok: true })
}
