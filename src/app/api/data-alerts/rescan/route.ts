import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const prisma = await getRequestPrisma()
  const alerts = await prisma.sYS_DataAlert.findMany({ where: { resolvedAt: null } })
  if (alerts.length === 0) return NextResponse.json({ cleaned: 0 })

  const staleIds: number[] = []

  for (const a of alerts) {
    if (!a.refId) continue
    if (a.refType === 'SYS_SyncJob') continue  // 保留 sync job 類告警

    let exists = false
    if (a.refType === 'SLS') {
      exists = !!(await prisma.sLS.findUnique({ where: { id: a.refId }, select: { id: true } }))
    } else if (a.refType === 'PI') {
      exists = !!(await prisma.pI.findUnique({ where: { id: a.refId }, select: { id: true } }))
    } else if (a.refType === 'PO_CustomerCopy') {
      exists = !!(await prisma.pO_CustomerCopy.findUnique({ where: { id: a.refId }, select: { id: true } }))
    } else if (a.refType === 'PO') {
      exists = !!(await prisma.pO.findUnique({ where: { id: a.refId }, select: { id: true } }))
    }

    if (!exists) staleIds.push(a.id)
  }

  if (staleIds.length > 0) {
    await prisma.sYS_DataAlert.updateMany({
      where: { id: { in: staleIds } },
      data: { resolvedAt: new Date() },
    })
  }

  return NextResponse.json({ cleaned: staleIds.length, total: alerts.length })
}
