import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

type Params = { params: { id: string } }

// GET /api/finance/payment-vouchers/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const voucher = await prisma.fIN_PaymentVoucher.findUnique({
    where: { id: Number(params.id) },
    include: {
      supplier: { select: { id: true, name: true, shortName: true, taxId: true } },
      items: {
        include: {
          payable: {
            include: {
              receipt: {
                include: {
                  order: {
                    select: { id: true, poNo: true, tradeTerms: true },
                  },
                  items: true,
                },
              },
            },
          },
        },
      },
      adjustments: true,
    },
  })

  if (!voucher) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(voucher)
}

// PATCH /api/finance/payment-vouchers/[id]
// 更新 status / 加 adjustment / 移除 item / 更新 note
export async function PATCH(req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const id = Number(params.id)

  const existing = await prisma.fIN_PaymentVoucher.findUnique({ where: { id }, select: { status: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 狀態推進
  if (body.status) {
    const STATUS_ORDER = ['DRAFT', 'SENT', 'CONFIRMED', 'PAID']
    const currentIdx = STATUS_ORDER.indexOf(existing.status)
    const nextIdx = STATUS_ORDER.indexOf(body.status)
    if (nextIdx < currentIdx) {
      return NextResponse.json({ error: '無法回退狀態' }, { status: 400 })
    }

    const now = new Date()
    const timeFields: Record<string, Date> = {}
    if (body.status === 'SENT') timeFields.sentAt = now
    if (body.status === 'CONFIRMED') timeFields.confirmedAt = now
    if (body.status === 'PAID') {
      timeFields.paidAt = now
      // 寫回所有 Payable → status=2（已付）
      const items = await prisma.fIN_PaymentVoucherItem.findMany({
        where: { voucherId: id },
        select: { payableId: true },
      })
      await prisma.fIN_Payable.updateMany({
        where: { id: { in: items.map(i => i.payableId) } },
        data: { status: 2, paidAt: now },
      })
    }

    const voucher = await prisma.fIN_PaymentVoucher.update({
      where: { id },
      data: { status: body.status, ...timeFields, note: body.note !== undefined ? body.note : undefined },
      include: {
        supplier: { select: { id: true, name: true, shortName: true } },
        items: { include: { payable: true } },
        adjustments: true,
      },
    })
    return NextResponse.json(voucher)
  }

  // 新增調整項目
  if (body.addAdjustment) {
    const adj = body.addAdjustment
    await prisma.fIN_PaymentVoucherAdjustment.create({
      data: {
        voucherId: id,
        name: adj.name,
        amountTWD: adj.amountTWD,
        category: adj.category ?? 'OTHER',
        note: adj.note || null,
      },
    })
  }

  // 刪除調整項目
  if (body.removeAdjustmentId) {
    await prisma.fIN_PaymentVoucherAdjustment.delete({ where: { id: body.removeAdjustmentId } })
  }

  // 更新 note / vatPct
  const updateData: Record<string, unknown> = {}
  if (body.note !== undefined) updateData.note = body.note
  if (body.vatPct !== undefined) updateData.vatPct = body.vatPct

  const voucher = await prisma.fIN_PaymentVoucher.update({
    where: { id },
    data: updateData,
    include: {
      supplier: { select: { id: true, name: true, shortName: true } },
      items: { include: { payable: true } },
      adjustments: true,
    },
  })
  return NextResponse.json(voucher)
}

// DELETE /api/finance/payment-vouchers/[id] — 僅 DRAFT 可刪，刪除後 Payable 解鎖
export async function DELETE(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  const existing = await prisma.fIN_PaymentVoucher.findUnique({ where: { id }, select: { status: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status !== 'DRAFT') {
    return NextResponse.json({ error: '只有草稿狀態的付款通知單可以刪除' }, { status: 400 })
  }

  await prisma.fIN_PaymentVoucher.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
