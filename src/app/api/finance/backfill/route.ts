import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { calcAndUpsertPayables } from '@/lib/ap-payable'
import { calcAndUpsertReceivable } from '@/lib/ar-receivable'

/**
 * POST /api/finance/backfill
 * 從現有出貨單和入庫記錄補建缺失的 FIN_Receivable / FIN_Payable。
 * 冪等：只建立不存在的記錄，不修改已有的。
 */
export async function POST(req: Request) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 支援指定單張出貨單：POST body { shipmentNo: "A251217" } 或不帶（全部）
  let body: { shipmentNo?: string } = {}
  try { body = await req.json() } catch { /* empty body is fine */ }

  const where = body.shipmentNo
    ? { shipmentNo: body.shipmentNo }
    : {}

  const shipments = await prisma.sLS.findMany({ where, select: { id: true } })
  if (shipments.length === 0) return NextResponse.json({ error: 'No shipments found' }, { status: 404 })

  let arCreated = 0, arSkipped = 0, arUpdated = 0
  let apCreated = 0, apSkipped = 0, apUpdated = 0

  for (const { id } of shipments) {
    const ar = await calcAndUpsertReceivable(prisma, id)
    arCreated += ar.created; arUpdated += ar.updated; arSkipped += ar.skipped

    const ap = await calcAndUpsertPayables(prisma, id)
    apCreated += ap.created; apUpdated += ap.updated; apSkipped += ap.skipped
  }

  return NextResponse.json({
    ok: true,
    shipments: shipments.length,
    ar: { created: arCreated, updated: arUpdated, skipped: arSkipped },
    ap: { created: apCreated, updated: apUpdated, skipped: apSkipped },
  })
}
