/**
 * DELETE /api/shipments/[id]/fob-cost-items/[itemId]  — 刪除貨代費用項目
 * 注意：若該費用已計算過分攤（SLS_FobCostAllocation），一併刪除分攤記錄
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

type Params = { params: { id: string; itemId: string } }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = Number(params.id)
  const itemId = Number(params.itemId)
  if (isNaN(shipmentId) || isNaN(itemId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  const item = await prisma.sLS_FobCostItem.findUnique({
    where: { id: itemId },
    select: { shipmentId: true },
  })
  if (!item || item.shipmentId !== shipmentId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 先刪分攤記錄，再刪本體
  await prisma.sLS_FobCostAllocation.deleteMany({ where: { costItemId: itemId } })
  await prisma.sLS_FobCostItem.delete({ where: { id: itemId } })

  return NextResponse.json({ ok: true })
}
