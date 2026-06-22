import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function GET(req: NextRequest) {
  const prisma = await getRequestPrisma()
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // '0' | '1' | '2' | null (all)
  const supplierId = searchParams.get('supplierId')

  const where: Record<string, unknown> = {}
  if (status !== null && status !== '') where.status = Number(status)
  if (supplierId) where.supplierId = Number(supplierId)

  const payables = await prisma.fIN_Payable.findMany({
    where,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    include: {
      supplier: { select: { id: true, name: true, shortName: true } },
      // 舊路徑（入庫觸發）
      receipt: {
        select: {
          receiptNo: true, performedAt: true,
          order: { select: { id: true, poNo: true } },
        },
      },
      // 新路徑（出貨觸發）
      shipment: { select: { id: true, shipmentNo: true, actualShipDate: true } },
      po: { select: { id: true, poNo: true } },
      // 批次付款連結
      batchPayable: { select: { id: true, shipment: { select: { shipmentNo: true } }, po: { select: { poNo: true } } } },
    },
  })

  return NextResponse.json(payables)
}
