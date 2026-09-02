/**
 * GET /api/print/pv/[voucherId]
 * 付款通知單 / 折讓單列印資料
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function GET(
  _req: NextRequest,
  { params }: { params: { voucherId: string } }
) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const voucherId = Number(params.voucherId)
  if (isNaN(voucherId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const voucher = await prisma.fIN_PaymentVoucher.findUnique({
    where: { id: voucherId },
    include: {
      supplier: {
        select: {
          id: true, name: true, shortName: true, taxId: true,
          address: true, city: true, countryCode: true,
          contactPerson: true, email: true,
        },
      },
      items: {
        include: {
          payable: {
            include: {
              po: { select: { id: true, poNo: true, tradeTerms: true } },
              receipt: {
                include: {
                  order: { select: { id: true, poNo: true, tradeTerms: true } },
                },
              },
            },
          },
        },
        orderBy: { id: 'asc' },
      },
      adjustments: { orderBy: { id: 'asc' } },
    },
  })

  if (!voucher) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const company = await prisma.sYS_Company.findFirst()

  const items = voucher.items
  const adjustments = voucher.adjustments

  // 計算金額
  const subtotalTWD = items.reduce((sum, i) => sum + Number(i.amountTWD), 0)
  const adjustmentTWD = adjustments.reduce((sum, a) => sum + Number(a.amountTWD), 0)
  const afterAdjustmentTWD = subtotalTWD + adjustmentTWD
  const vatTWD = Math.round(afterAdjustmentTWD * Number(voucher.vatPct) / 100)
  const totalTWD = afterAdjustmentTWD + vatTWD

  // FOB 扣款項目（LOGISTICS 或 FORMULA 類，負數）
  const fobDeductionTWD = adjustments
    .filter(a => (a.category === 'LOGISTICS' || a.category === 'FORMULA') && Number(a.amountTWD) < 0)
    .reduce((sum, a) => sum + Number(a.amountTWD), 0)

  // 佣金扣款項目
  const commissionDeductionTWD = adjustments
    .filter(a => a.category === 'COMMISSION' && Number(a.amountTWD) < 0)
    .reduce((sum, a) => sum + Number(a.amountTWD), 0)

  const sup = voucher.supplier

  return NextResponse.json({
    voucher: {
      id: voucher.id,
      voucherNo: voucher.voucherNo,
      status: voucher.status,
      vatPct: Number(voucher.vatPct),
      note: voucher.note,
      supplierInvoiceNo: voucher.supplierInvoiceNo,
      supplierInvoicePrefix: (voucher as Record<string, unknown>).supplierInvoicePrefix as string | null ?? null,
      supplierInvoiceDate: ((voucher as Record<string, unknown>).supplierInvoiceDate as Date | null)?.toISOString() ?? null,
      sentAt: voucher.sentAt?.toISOString() ?? null,
      confirmedAt: voucher.confirmedAt?.toISOString() ?? null,
      paidAt: voucher.paidAt?.toISOString() ?? null,
      createdAt: voucher.createdAt.toISOString(),
    },
    supplier: {
      id: sup.id,
      name: sup.name,
      shortName: sup.shortName ?? null,
      taxId: sup.taxId ?? null,
      address: sup.address ?? null,
      city: sup.city ?? null,
      countryCode: sup.countryCode ?? null,
      contactPerson: sup.contactPerson ?? null,
      email: sup.email ?? null,
    },
    company: company ? {
      nameZh: company.nameZh,
      nameEn: company.nameEn,
      addressZh: company.addressZh,
      phone: company.phone,
      fax: company.fax,
      email: company.email,
      taxId: company.taxId,
      bankName: company.bankName,
      bankAccount: company.bankAccount,
      logoBase64: company.logoBase64 ?? null,
    } : null,
    items: items.map(i => ({
      id: i.id,
      payableId: i.payableId,
      poNo: i.payable.po?.poNo ?? i.payable.receipt?.order?.poNo ?? null,
      tradeTerms: i.payable.po?.tradeTerms ?? i.payable.receipt?.order?.tradeTerms ?? null,
      amountTWD: Number(i.amountTWD),
      fobCostDeductionTWD: Number(i.payable.fobCostDeductionTWD),
    })),
    adjustments: adjustments.map(a => ({
      id: a.id,
      name: a.name,
      amountTWD: Number(a.amountTWD),
      category: a.category,
      note: a.note ?? null,
    })),
    totals: {
      subtotalTWD,
      adjustmentTWD,
      afterAdjustmentTWD,
      vatPct: Number(voucher.vatPct),
      vatTWD,
      totalTWD,
      fobDeductionTWD,
      commissionDeductionTWD,
    },
  })
}
