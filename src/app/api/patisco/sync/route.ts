import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { syncPatiscoPIs, syncPatiscoBuyers, syncPatiscoSupplierPOs, syncPatiscoDeliveryOrders, backfillShipmentPILinks, seedDOQueue, processNextPendingDO } from '@/api/patisco/sync'
import { patiscoLogin } from '@/api/patisco/client'

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
export const maxDuration = 300  // Vercel Pro 最長 300s（Patisco API 較慢需要緩衝）

export async function POST(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 在 route handler 層取一次 prisma，確保 session context 正確
  
  const body = await req.json().catch(() => ({})) as { type?: string; batchLimit?: number }
  const type = body.type ?? 'all'

  const start = Date.now()

  try {
    const result: Record<string, unknown> = {}

    // 登入一次，避免每個 function 重複登入（每次 login 耗時 5-15s）
    const creds = await patiscoLogin(prisma)

    if (type === 'buyers' || type === 'all') {
      result.buyers = await syncPatiscoBuyers('manual', prisma, creds ?? undefined)
    }
    if (type === 'pi' || type === 'all') {
      result.pi = await syncPatiscoPIs('manual', prisma, undefined, creds ?? undefined)
    }
    if (type === 'po' || type === 'all') {
      result.po = await syncPatiscoSupplierPOs('manual', prisma, undefined, creds ?? undefined)
    }
    if (type === 'seed-do-queue') {
      result.seed = await seedDOQueue(prisma, creds ?? undefined)
    }
    if (type === 'process-next-do') {
      result.do = await processNextPendingDO('manual', prisma, undefined, creds ?? undefined)
    }
    if (type === 'deliveries' || type === 'all') {
      // 向後相容：seed + process 1
      result.deliveries = await syncPatiscoDeliveryOrders('manual', prisma)
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
    if (type === 'mark-do-partial') {
      // 找出 status=ok 但有以下任一情況的 DO，標記為 partial 讓 cron 重新排程：
      // 1. 對應出貨單沒有任何 SLS_ShipmentPI（header 層未關聯）
      // 2. 對應出貨單有任何 SLS_ShipmentItem.piId = null（item 層未關聯）
      const okDOs = await prisma.sYS_PatiscoSync.findMany({
        where: { docType: 'DO', status: { in: ['ok', 'partial'] } },
        select: { id: true, patiscoDocId: true },
      })
      let marked = 0
      for (const row of okDOs) {
        const shipment = await prisma.sLS_Shipment.findFirst({
          where: { patiscoDocId: row.patiscoDocId },
          select: {
            id: true,
            _count: { select: { pis: true } },
          },
        })
        if (!shipment) continue
        const noPIHeader = shipment._count.pis === 0
        const unlinkedItems = noPIHeader ? 0 : await prisma.sLS_ShipmentItem.count({
          where: { shipmentId: shipment.id, piId: null },
        })
        if (noPIHeader || unlinkedItems > 0) {
          await prisma.sYS_PatiscoSync.update({
            where: { id: row.id },
            data: { status: 'partial' },
          })
          marked++
        }
      }
      result.markPartial = { checked: okDOs.length, marked }
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
