/**
 * GET /api/shipments/[id]/outstanding
 * 查詢此出貨單「尚未收尾」的項目（未 CONFIRMED 的供應商通知單、
 * 庫存是否已扣減），供「確認出貨」按鈕在動作前呈現。
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { getOutstandingItems } from '@/lib/shipment-outstanding'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = Number(params.id)
  if (isNaN(shipmentId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const outstanding = await getOutstandingItems(prisma, shipmentId)
  return NextResponse.json(outstanding)
}
