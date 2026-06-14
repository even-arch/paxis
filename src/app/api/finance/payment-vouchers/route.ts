import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

// GET  /api/finance/payment-vouchers?supplierId=X
// POST /api/finance/payment-vouchers  — create voucher + items + adjustments

export async function GET(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const supplierId = searchParams.get('supplierId')

  const vouchers = await prisma.fIN_PaymentVoucher.findMany({
    where: supplierId ? { supplierId: Number(supplierId) } : undefined,
    include: {
      supplier: { select: { id: true, name: true, shortName: true } },
      items: {
        include: {
          payable: {
            include: {
              receipt: {
                include: { order: { select: { id: true, poNo: true } } },
              },
            },
          },
        },
      },
      adjustments: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(vouchers)
}

export async function POST(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { supplierId, payableIds, adjustments, vatPct, note } = body

  if (!supplierId || !payableIds?.length) {
    return NextResponse.json({ error: '請選擇供應商與至少一張付款單' }, { status: 400 })
  }

  // 確認所有 Payable 都屬於該供應商且尚未被包入其他 Voucher
  const payables = await prisma.fIN_Payable.findMany({
    where: {
      id: { in: payableIds },
      supplierId: Number(supplierId),
      voucherItem: null,
    },
  })

  if (payables.length !== payableIds.length) {
    return NextResponse.json({ error: '部分單據已被加入其他付款通知單，或不屬於此供應商' }, { status: 400 })
  }

  // 生成流水號 PV-YYYYMMDD-XXXX
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const countToday = await prisma.fIN_PaymentVoucher.count({
    where: { voucherNo: { startsWith: `PV-${dateStr}` } },
  })
  const voucherNo = `PV-${dateStr}-${String(countToday + 1).padStart(4, '0')}`

  const voucher = await prisma.fIN_PaymentVoucher.create({
    data: {
      voucherNo,
      supplierId: Number(supplierId),
      vatPct: vatPct ?? 5,
      note: note || null,
      items: {
        create: payables.map(p => ({
          payableId: p.id,
          amountTWD: p.amountTWD,
        })),
      },
      adjustments: {
        create: (adjustments ?? []).map((a: { name: string; amountTWD: number; category?: string; note?: string }) => ({
          name: a.name,
          amountTWD: a.amountTWD,
          category: a.category ?? 'OTHER',
          note: a.note || null,
        })),
      },
    },
    include: {
      supplier: { select: { id: true, name: true, shortName: true } },
      items: { include: { payable: true } },
      adjustments: true,
    },
  })

  return NextResponse.json(voucher, { status: 201 })
}
