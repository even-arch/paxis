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
    collectedForeign?: number | null
    rateAtCollection?: number | null
    collectedTWD?: number | null
    fxGainLoss?: number | null
    collectedAt?: string | null
    status?: number
    note?: string | null
  }

  const rec = await prisma.fIN_Receivable.findUnique({ where: { id: Number(params.id) } })
  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 退回未收：傳入 status=0 且 collectedForeign=null
  if (body.status === 0 && body.collectedForeign === null) {
    const updated = await prisma.fIN_Receivable.update({
      where: { id: Number(params.id) },
      data: { collectedForeign: null, rateAtCollection: null, collectedTWD: null, fxGainLoss: null, collectedAt: null, status: 0, note: null },
    })
    return NextResponse.json(updated)
  }

  const collectedForeign = body.collectedForeign != null
    ? new Decimal(body.collectedForeign)
    : rec.collectedForeign ?? new Decimal(0)

  const rateAtCollection = body.rateAtCollection != null
    ? new Decimal(body.rateAtCollection)
    : rec.rateAtCollection ?? rec.rateAtInvoice

  const collectedTWD = collectedForeign.mul(rateAtCollection)
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
      note: body.note !== undefined ? (body.note ?? undefined) : undefined,
    },
  })

  return NextResponse.json(updated)
}
