/**
 * POST /api/patisco/catalog-sync
 * 手動觸發 Patisco 商品型錄同步
 * 需要登入（session 驗證）
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { syncPatiscoCatalog } from '@/api/patisco/catalog-sync'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const start = Date.now()
  try {
    const result = await syncPatiscoCatalog()
    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - start,
      ...result,
    })
  } catch (err) {
    console.error('[catalog-sync]', err)
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    }, { status: 500 })
  }
}
