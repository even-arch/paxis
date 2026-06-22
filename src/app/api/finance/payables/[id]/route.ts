import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { Decimal } from '@prisma/client/runtime/library'

type Params = { params: { id: string } }

// 更新付款狀態與費用明細
export async function PATCH(req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    // 費用明細（台灣出貨明細表各項目）
    customsFeeTWD?:      number | null
    truckingFeeTWD?:     number | null
    containerFeeTWD?:    number | null
    bankFeePct?:         number | null  // 百分比，例如 0.7 表示 0.7%
    portServiceFeeTWD?:  number | null
    wireTransferFeeTWD?: number | null
    commissionTWD?:      number | null
    otherAdjustmentTWD?:   number | null
    otherAdjustmentNote?:  string | null
    vatPct?:             number | null  // 百分比，例如 5 表示 5%
    finalWireAmountTWD?: number | null  // 使用者確認後的最終匯款金額
    // 付款記錄
    paidAmountTWD?:      number | null
    paidAt?:             string | null
    note?:               string
    // 批次付款時可直接傳入 status 覆寫（避免浮點精度問題）
    status?:             number
    // 批次付款：記錄主單 id
    batchPayableId?:     number | null
  }

  const payable = await prisma.fIN_Payable.findUnique({ where: { id: Number(params.id) } })
  if (!payable) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const paidAmount = (body.paidAmountTWD != null && body.paidAmountTWD !== 0)
    ? new Decimal(body.paidAmountTWD)
    : body.paidAmountTWD === 0 ? new Decimal(0)
    : payable.paidAmountTWD ?? new Decimal(0)

  let status: number
  if (body.status != null) {
    status = body.status
  } else {
    const baseAmount = body.finalWireAmountTWD != null
      ? new Decimal(body.finalWireAmountTWD)
      : payable.finalWireAmountTWD ?? payable.amountTWD
    const isFullyPaid = paidAmount.gte(baseAmount)
    status = isFullyPaid ? 2 : paidAmount.gt(0) ? 1 : 0
  }

  const updated = await prisma.fIN_Payable.update({
    where: { id: Number(params.id) },
    data: {
      ...(body.customsFeeTWD      !== undefined && { customsFeeTWD:      body.customsFeeTWD      != null ? new Decimal(body.customsFeeTWD)      : null }),
      ...(body.truckingFeeTWD     !== undefined && { truckingFeeTWD:     body.truckingFeeTWD     != null ? new Decimal(body.truckingFeeTWD)     : null }),
      ...(body.containerFeeTWD    !== undefined && { containerFeeTWD:    body.containerFeeTWD    != null ? new Decimal(body.containerFeeTWD)    : null }),
      ...(body.bankFeePct         !== undefined && { bankFeePct:         body.bankFeePct         != null ? new Decimal(body.bankFeePct)         : null }),
      ...(body.portServiceFeeTWD  !== undefined && { portServiceFeeTWD:  body.portServiceFeeTWD  != null ? new Decimal(body.portServiceFeeTWD)  : null }),
      ...(body.wireTransferFeeTWD !== undefined && { wireTransferFeeTWD: body.wireTransferFeeTWD != null ? new Decimal(body.wireTransferFeeTWD) : null }),
      ...(body.commissionTWD      !== undefined && { commissionTWD:      body.commissionTWD      != null ? new Decimal(body.commissionTWD)      : null }),
      ...(body.otherAdjustmentTWD  !== undefined && { otherAdjustmentTWD:  body.otherAdjustmentTWD  != null ? new Decimal(body.otherAdjustmentTWD)  : null }),
      ...(body.otherAdjustmentNote !== undefined && { otherAdjustmentNote: body.otherAdjustmentNote }),
      ...(body.vatPct              !== undefined && { vatPct:              body.vatPct              != null ? new Decimal(body.vatPct)              : null }),
      ...(body.finalWireAmountTWD  !== undefined && { finalWireAmountTWD:  body.finalWireAmountTWD  != null ? new Decimal(body.finalWireAmountTWD)  : null }),
      paidAmountTWD: paidAmount,
      paidAt: body.paidAt === null ? null : body.paidAt ? new Date(body.paidAt) : (status === 2 ? new Date() : undefined),
      status,
      ...(body.note !== undefined && { note: body.note }),
      ...(body.batchPayableId !== undefined && { batchPayableId: body.batchPayableId }),
    },
  })

  return NextResponse.json(updated)
}
