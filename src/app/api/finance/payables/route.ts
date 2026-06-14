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
      receipt: {
        select: {
          receiptNo: true, performedAt: true,
          order: { select: { id: true, poNo: true } },
        },
      },
    },
    // 全欄位回傳（費用明細欄位皆在其中）
  })

  return NextResponse.json(payables)
}
