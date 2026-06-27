import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids, action } = await req.json() as { ids: number[]; action: 'archive' | 'unarchive' }
  if (!ids?.length) return NextResponse.json({ error: '請選擇至少一筆' }, { status: 400 })

  const prisma = await getRequestPrisma()
  const now = new Date()

  // 封存出貨單
  const result = await prisma.sLS.updateMany({
    where: { id: { in: ids } },
    data: { archivedAt: action === 'archive' ? now : null },
  })

  let piArchived = 0
  let poArchived = 0

  if (action === 'archive') {
    // 找出這些出貨單連結的所有 PI（透過 SLS_PI_Link）
    const links = await prisma.sLS_PI_Link.findMany({
      where: { shipmentId: { in: ids } },
      select: { piId: true },
    })
    const piIds = Array.from(new Set(links.map(l => l.piId)))

    for (const piId of piIds) {
      // PI 完整出貨判定：SLS_Item 合計 >= PI_Item 合計
      const [piItemSum, slsItemSum] = await Promise.all([
        prisma.pI_Item.aggregate({ where: { piId }, _sum: { quantity: true } }),
        prisma.sLS_Item.aggregate({ where: { piId }, _sum: { quantity: true } }),
      ])
      const piTotal = piItemSum._sum.quantity ?? 0
      const shipped = slsItemSum._sum.quantity ?? 0
      if (piTotal === 0 || shipped < piTotal) continue

      // PI 完整出完 → 封存
      await prisma.pI.update({ where: { id: piId }, data: { archivedAt: now } })
      piArchived++

      // 找連結的 PO（slsPiId FK，或 poNo = piNo fallback）
      const pi = await prisma.pI.findUnique({ where: { id: piId }, select: { piNo: true, poOrders: { select: { id: true } } } })
      if (!pi) continue

      let poIds = pi.poOrders.map(p => p.id)
      if (poIds.length === 0) {
        const poByNo = await prisma.pO.findMany({ where: { poNo: pi.piNo }, select: { id: true } })
        poIds = poByNo.map(p => p.id)
      }

      for (const poId of poIds) {
        // PO 完整收貨判定：所有 PO_Item.receivedQty >= quantity
        const items = await prisma.pO_Item.findMany({ where: { orderId: poId }, select: { quantity: true, receivedQty: true } })
        if (items.length === 0) continue
        const fullyReceived = items.every(i => i.receivedQty >= i.quantity)
        if (!fullyReceived) continue

        await prisma.pO.update({ where: { id: poId }, data: { archivedAt: now } })
        poArchived++
      }
    }
  }

  return NextResponse.json({ updated: result.count, piArchived, poArchived })
}
