import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { Decimal } from '@prisma/client/runtime/library'

type Params = { params: { id: string } }

// 記錄收款（含押匯匯率）
export async function PATCH(req: NextRequest, {
  params }: Params) {
  const prisma = await getRequestPrisma()
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    collectedForeign?: number  // 實收 EUR 金額
    rateAtCollection?: number  // 押匯匯率
    collectedAt?: string
    note?: string
  }

  const rec = await prisma.fIN_Receivable.findUnique({ where: { id: Number(params.id) } })
  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const collectedForeign = body.collectedForeign
    ? new Decimal(body.collectedForeign)
    : rec.collectedForeign ?? new Decimal(0)

  const rateAtCollection = body.rateAtCollection
    ? new Decimal(body.rateAtCollection)
    : rec.rateAtCollection ?? rec.rateAtInvoice

  const collectedTWD = collectedForeign.mul(rateAtCollection)
  // 匯差 = 實收 TWD - 帳面 TWD（按報帳匯率）
  const fxGainLoss = collectedTWD.sub(collectedForeign.mul(rec.rateAtInvoice))

  const isFullyCollected = collectedForeign.gte(rec.amountForeign)
  const status = isFullyCollected ? 2 : collectedForeign.gt(0) ? 1 : 0

  const updated = await prisma.fIN_Receivable.update({
    where: { id: Number(params.id) },
    data: {
      collectedForeign,
      rateAtCollection,
      collectedTWD,
      fxGainLoss,
      collectedAt: body.collectedAt ? new Date(body.collectedAt) : (isFullyCollected ? new Date() : undefined),
      status,
      note: body.note ?? undefined,
    },
  })

  return NextResponse.json(updated)
}
