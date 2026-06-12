import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { syncPatiscoPIs, syncPatiscoBuyers, syncPatiscoSupplierPOs, syncPatiscoDeliveryOrders, backfillShipmentPILinks } from '@/api/patisco/sync'

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
export const maxDuration = 60  // Vercel Pro 最長 60s

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 在 route handler 層取一次 prisma，確保 session context 正確
  
  const body = await req.json().catch(() => ({})) as { type?: string; batchLimit?: number }
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
      const batchLimit = body.batchLimit as number | undefined
      result.deliveries = await syncPatiscoDeliveryOrders('manual', prisma, undefined, undefined, batchLimit ?? 5)
    }
    if (type === 'backfill-shipment-pi') {
      result.backfill = await backfillShipmentPILinks('manual', prisma)
    }
    if (type === 'reset-do-sync') {
      // 清除所有 DO 的 ok 狀態，讓下次同步強制重新處理
      const deleted = await prisma.sYS_PatiscoSync.deleteMany({
        where: { docType: 'DO', status: 'ok' },
      })
      result.reset = { deleted: deleted.count }
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
