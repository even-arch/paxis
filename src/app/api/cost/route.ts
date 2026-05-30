import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limit = 20

  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { product: { name: { contains: search } } },
          { product: { sku: { contains: search } } },
          { htsCode: { contains: search } },
        ],
      }
    : {}

  const [total, sheets] = await Promise.all([
    prisma.cOST_Sheet.count({ where }),
    prisma.cOST_Sheet.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        creator: { select: { name: true } },
      },
    }),
  ])

  return NextResponse.json({ sheets, total, page, totalPages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // 計算到岸成本
  const fobUsd = Number(body.fobPrice) * Number(body.fobExRate)
  const dutyAmt = body.dutyRate ? fobUsd * Number(body.dutyRate) : (Number(body.dutyAmount) || 0)
  const landedCost =
    fobUsd +
    dutyAmt +
    Number(body.oceanFreight || 0) +
    Number(body.insurance || 0) +
    Number(body.agentFee || 0) +
    Number(body.consolidation || 0) +
    Number(body.deconsolidation || 0) +
    Number(body.userFee || 0) +
    Number(body.harborFee || 0) +
    Number(body.otherCharge || 0)

  const sellingPrice = Number(body.sellingPrice) || 0
  const grossMarginPct = sellingPrice > 0
    ? ((sellingPrice - landedCost) / sellingPrice)
    : null

  const sheet = await prisma.cOST_Sheet.create({
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
      createdBy: Number(session.user.id),
    },
  })

  return NextResponse.json(sheet, { status: 201 })
}
