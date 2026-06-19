import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { step7_buildOnePIFromDocId } from '@/api/patisco/sync'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { piNo?: string; chosenDocId?: string; jobId?: number }
  const { piNo, chosenDocId, jobId } = body
  if (!piNo || !chosenDocId) {
    return NextResponse.json({ ok: false, error: 'piNo 和 chosenDocId 為必填' }, { status: 400 })
  }

  const prisma = await getRequestPrisma()
  try {
    await step7_buildOnePIFromDocId(prisma, chosenDocId, jobId ?? 0)
    return NextResponse.json({ ok: true, piNo, chosenDocId })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
