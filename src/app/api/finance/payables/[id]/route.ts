import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Decimal } from '@prisma/client/runtime/library'

type Params = { params: { id: string } }

// 更新付款狀態（記錄付款）
export async function PATCH(req: NextRequest, {
  params }: Params) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    paidAmountTWD?: number
    paidAt?: string
    note?: string
  }

  const payable = await prisma.fIN_Payable.findUnique({ where: { id: Number(params.id) } })
  if (!payable) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const paidAmount = body.paidAmountTWD ? new Decimal(body.paidAmountTWD) : payable.paidAmountTWD ?? new Decimal(0)
  const isFullyPaid = paidAmount.gte(payable.amountTWD)
  const status = isFullyPaid ? 2 : paidAmount.gt(0) ? 1 : 0

  const updated = await prisma.fIN_Payable.update({
    where: { id: Number(params.id) },
    data: {
      paidAmountTWD: paidAmount,
      paidAt: body.paidAt ? new Date(body.paidAt) : (isFullyPaid ? new Date() : undefined),
      status,
      note: body.note ?? undefined,
    },
  })

  return NextResponse.json(updated)
}
