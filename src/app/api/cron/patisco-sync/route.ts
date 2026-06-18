import { NextRequest, NextResponse } from 'next/server'
import { runPatiscoSync } from '@/api/patisco/sync'
import { patiscoLogin } from '@/api/patisco/client'
import { getRequestPrisma } from '@/lib/request-db'

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()

  try {
    const config = await prisma.sYS_PatiscoConfig.findFirst({ where: { isActive: true } })
    if (config && config.syncEnabled === false) {
      return NextResponse.json({
        ok: false,
        skipped: true,
        reason: 'Patisco sync 已暫停（syncEnabled = false）。請至設定 → Patisco 連結開啟。',
        durationMs: Date.now() - start,
      })
    }

    const creds = await patiscoLogin(prisma)
    const result = await runPatiscoSync('cron', prisma, creds ?? undefined)

    return NextResponse.json({ ok: true, durationMs: Date.now() - start, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/patisco-sync] 失敗:', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
