/**
 * POST /api/shipments/[id]/confirm-all
 * 一鍵批次確認：由「確認出貨」按鈕觸發，把還沒收尾的供應商通知單
 * 一併標記完成（供應商實務上常透過 LINE/電話等其他管道確認出貨，
 * 不一定會走系統的 Email 寄送流程），並可一併驅動庫存確認。
 *
 * - noticeIds：要標記為 CONFIRMED 的出貨通知單（保留原 note，附加確認記錄）
 * - confirmShipment：是否連同觸發「確認出貨」（庫存扣減 + 應收帳款；冪等）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { confirmShipment } from '@/lib/confirm-shipment'
import { taipeiDateISO } from '@/lib/utils'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = Number(params.id)
  if (isNaN(shipmentId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const body = await req.json() as { noticeIds?: number[]; confirmShipment?: boolean }
  const noticeIds = body.noticeIds ?? []

  const performedBy = (() => {
    const uid = ((session.user as unknown) as { id?: unknown }).id
    return uid != null ? parseInt(String(uid), 10) : null
  })()
  const performerName = session.user?.name ?? session.user?.email ?? '使用者'
  const auditLine = `\n[確認出貨時一併確認 ${taipeiDateISO()}，操作人：${performerName}] 供應商已於其他管道（如 LINE/電話）確認出貨，非經系統 Email 流程`

  let noticesConfirmed = 0
  if (noticeIds.length > 0) {
    const notices = await prisma.pO_ShippingNotice.findMany({
      where: { id: { in: noticeIds }, sourceShipmentId: shipmentId },
      select: { id: true, note: true, status: true },
    })
    for (const notice of notices) {
      if (notice.status === 'CONFIRMED') continue
      await prisma.pO_ShippingNotice.update({
        where: { id: notice.id },
        data: { status: 'CONFIRMED', note: (notice.note ?? '') + auditLine },
      })
      noticesConfirmed++
    }
  }

  let shipmentResult: { invConfirmed: number; invSkipped: number; arCreated: boolean; poReceiptsCreated: number } | null = null
  if (body.confirmShipment) {
    try {
      shipmentResult = await confirmShipment(prisma, shipmentId, performedBy)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return NextResponse.json(
        { error: `通知單已確認 ${noticesConfirmed} 張，但出貨確認失敗：${msg}`, noticesConfirmed },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ ok: true, noticesConfirmed, shipmentResult })
}
