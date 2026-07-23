import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { checkShippedButNotReceived } from '@/api/patisco/sync'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const prisma = await getRequestPrisma()

  // 手動觸發「PI 已出貨但 PO 未入庫」偵測，不用等下次 Patisco 同步
  const { created } = await checkShippedButNotReceived(prisma, null)

  const alerts = await prisma.sYS_DataAlert.findMany({ where: { resolvedAt: null } })
  if (alerts.length === 0) return NextResponse.json({ cleaned: 0, created })

  const staleIds: number[] = []

  for (const a of alerts) {
    if (!a.refId) continue
    if (a.refType === 'SYS_SyncJob') continue  // 保留 sync job 類告警

    let exists = false
    // WORKFLOW_GAP 型的 PO 告警：不能只查「這張 PO 還在不在」，
    // 還要重新驗證「條件是否仍然成立」——PO 沒被刪除，但如果已經補入庫，
    // 告警本身就該跟著解除，否則會變成永遠留著的殭屍告警。
    let conditionStillTrue = true

    if (a.refType === 'SLS') {
      exists = !!(await prisma.sLS.findUnique({ where: { id: a.refId }, select: { id: true } }))
    } else if (a.refType === 'PI') {
      exists = !!(await prisma.pI.findUnique({ where: { id: a.refId }, select: { id: true } }))
    } else if (a.refType === 'PO_CustomerCopy') {
      exists = !!(await prisma.pO_CustomerCopy.findUnique({ where: { id: a.refId }, select: { id: true } }))
    } else if (a.refType === 'PO') {
      const po = await prisma.pO.findUnique({
        where: { id: a.refId },
        select: { items: { select: { quantity: true, receivedQty: true } } },
      })
      exists = !!po
      if (po && a.type === 'WORKFLOW_GAP') {
        const totalQty = po.items.reduce((s, i) => s + i.quantity, 0)
        const receivedQty = po.items.reduce((s, i) => s + i.receivedQty, 0)
        conditionStillTrue = totalQty > 0 && receivedQty < totalQty
      }
    }

    if (!exists || !conditionStillTrue) staleIds.push(a.id)
  }

  if (staleIds.length > 0) {
    await prisma.sYS_DataAlert.updateMany({
      where: { id: { in: staleIds } },
      data: { resolvedAt: new Date() },
    })
  }

  return NextResponse.json({ cleaned: staleIds.length, total: alerts.length, created })
}
