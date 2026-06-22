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
export async function POST() {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── AR：從 SLS 補建 FIN_Receivable ────────────────────────────
  const shipmentsWithoutReceivable = await prisma.sLS.findMany({ select: { id: true } })

  // ── AR：item-level（SLS_Item.unitPrice × quantity / ciExchangeRate）─────
  let arCreated = 0, arSkipped = 0, arUpdated = 0
  for (const shipment of shipmentsWithoutReceivable) {
    const r = await calcAndUpsertReceivable(prisma, shipment.id)
    arCreated += r.created
    arUpdated += r.updated
    arSkipped += r.skipped
  }

  // ── AP：從 SLS_Shipment 補建 FIN_Payable（item-level 成本分攤）─────
  const allShipments = await prisma.sLS.findMany({ select: { id: true } })
  let apCreated = 0, apSkipped = 0, apUpdated = 0
  for (const { id } of allShipments) {
    const r = await calcAndUpsertPayables(prisma, id)
    apCreated += r.created
    apUpdated += r.updated
    apSkipped += r.skipped
  }

  return NextResponse.json({
    ok: true,
    ar: { created: arCreated, updated: arUpdated, skipped: arSkipped },
    ap: { created: apCreated, updated: apUpdated, skipped: apSkipped },
  })
}
