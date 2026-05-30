import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sheet = await prisma.cOST_Sheet.findUnique({
    where: { id: Number(params.id) },
    include: {
      product: {
        select: {
          id: true, name: true, sku: true, modelNo: true, unit: true,
          unitPerInner: true, unitPerCarton: true, cbm: true,
          grossWeight: true, netWeight: true, htsCode: true, countryOfOrigin: true,
        },
      },
      creator: { select: { name: true } },
    },
  })

  if (!sheet) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(sheet)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const fobUsd = Number(body.fobPrice) * Number(body.fobExRate)
  const dutyAmt = body.dutyRate ? fobUsd * Number(body.dutyRate) : (Number(body.dutyAmount) || 0)
  const landedCost =
    fobUsd + dutyAmt +
    Number(body.oceanFreight || 0) + Number(body.insurance || 0) +
    Number(body.agentFee || 0) + Number(body.consolidation || 0) +
    Number(body.deconsolidation || 0) + Number(body.userFee || 0) +
    Number(body.harborFee || 0) + Number(body.otherCharge || 0)

  const sellingPrice = Number(body.sellingPrice) || 0
  const grossMarginPct = sellingPrice > 0 ? ((sellingPrice - landedCost) / sellingPrice) : null

  const sheet = await prisma.cOST_Sheet.update({
    where: { id: Number(params.id) },
    data: {
      name: body.name,
      productId: Number(body.productId),
      fobPrice: String(body.fobPrice),
      fobCurrency: body.fobCurrency,
      fobExRate: String(body.fobExRate),
      countryOfOrigin: body.countryOfOrigin || null,
      portOfLoading: body.portOfLoading || null,
      htsCode: body.htsCode || null,
      dutyRate: body.dutyRate ? String(body.dutyRate) : null,
      dutyAmount: String(dutyAmt.toFixed(4)),
      oceanFreight: body.oceanFreight ? String(body.oceanFreight) : null,
      insurance: body.insurance ? String(body.insurance) : null,
      agentFee: body.agentFee ? String(body.agentFee) : null,
      consolidation: body.consolidation ? String(body.consolidation) : null,
      deconsolidation: body.deconsolidation ? String(body.deconsolidation) : null,
      userFee: body.userFee ? String(body.userFee) : null,
      harborFee: body.harborFee ? String(body.harborFee) : null,
      otherCharge: body.otherCharge ? String(body.otherCharge) : null,
      otherChargeNote: body.otherChargeNote || null,
      landedCost: String(landedCost.toFixed(4)),
      sellingPrice: sellingPrice > 0 ? String(sellingPrice) : null,
      grossMarginPct: grossMarginPct !== null ? String(grossMarginPct.toFixed(6)) : null,
      container40ftQty: body.container40ftQty ? Number(body.container40ftQty) : null,
      container40ftPcs: body.container40ftPcs ? Number(body.container40ftPcs) : null,
    },
  })

  return NextResponse.json(sheet)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.cOST_Sheet.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
