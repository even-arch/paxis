import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { confirmShipment } from '@/lib/confirm-shipment'

/**
 * POST /api/shipments/[id]/confirm
 * 確認出貨並記錄相關的財務資訊，邏輯見 src/lib/confirm-shipment.ts
 * （與批次確認 customs-docs/confirm-all 共用同一套邏輯）。
 *
 * 注意：應付帳款不自動創建，由用戶在對帳頁面手工確認。
 * 冪等保護：已有 type=4 Movement 則拒絕重複。
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = parseInt(params.id, 10)
  if (isNaN(shipmentId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const performedBy = (() => {
    const uid = ((session.user as unknown) as { id?: unknown }).id
    return uid != null ? parseInt(String(uid), 10) : null
  })()

  try {
    const result = await confirmShipment(prisma, shipmentId, performedBy)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: msg === '找不到出貨單' ? 404 : 500 })
  }
}
