import { NextRequest, NextResponse } from 'next/server'
import { syncPatiscoPIs } from '@/api/patisco/sync'

/**
 * Vercel Cron Job — 每 5 分鐘輪詢 Patisco 已確認 PI
 * 設定在 vercel.json 的 crons 區塊
 *
 * 安全機制：只允許 Vercel 的 cron 呼叫（驗證 CRON_SECRET）
 */
export async function GET(req: NextRequest) {
  // 驗證 Vercel Cron Secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()

  try {
    const result = await syncPatiscoPIs('cron')

    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - start,
      ...result,
    })
  } catch (err) {
    console.error('[cron/patisco-sync]', err)
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    }, { status: 500 })
  }
}
