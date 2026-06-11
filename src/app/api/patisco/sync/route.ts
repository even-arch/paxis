import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { syncPatiscoPIs, syncPatiscoBuyers, syncPatiscoSupplierPOs, syncPatiscoDeliveryOrders } from '@/api/patisco/sync'

/**
 * POST /api/patisco/sync
 * 手動觸發 Patisco 同步
 *
 * body: { type?: 'pi' | 'buyers' | 'all' }
 * 預設：all
 *
 * prisma 在 route handler 層取得後傳入 sync 函式，
 * 避免深層 async 鏈裡 getServerSession 讀不到 session context。
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 在 route handler 層取一次 prisma，確保 session context 正確
  
  const body = await req.json().catch(() => ({})) as { type?: string }
  const type = body.type ?? 'all'

  const start = Date.now()

  try {
    const result: Record<string, unknown> = {}

    if (type === 'buyers' || type === 'all') {
      result.buyers = await syncPatiscoBuyers('manual', prisma)
    }
    if (type === 'pi' || type === 'all') {
      result.pi = await syncPatiscoPIs('manual', prisma)
    }
    if (type === 'po' || type === 'all') {
      result.po = await syncPatiscoSupplierPOs('manual', prisma)
    }
    if (type === 'deliveries' || type === 'all') {
      result.deliveries = await syncPatiscoDeliveryOrders('manual', prisma)
    }

    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - start,
      ...result,
    })
  } catch (err) {
    console.error('[patisco/sync]', err)
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    }, { status: 500 })
  }
}
