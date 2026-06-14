import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: { poId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const poId = Number(params.poId)
  if (isNaN(poId)) return NextResponse.json({ error: 'Invalid poId' }, { status: 400 })

  const po = await prisma.pO_Order.findUnique({
    where: { id: poId },
    include: {
      supplier: true,
      items: {
        include: {
          product: {
            select: {
              name: true,
              sku: true,
              modelNo: true,
              specification: true,
              unit: true,
            },
          },
        },
      },
    },
  })

  if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 })

  const company = await prisma.sYS_Company.findFirst()

  const items = po.items.map(item => {
    const unitPrice = Number(item.unitPrice)
    const amount = unitPrice * item.quantity
    return {
      productName: item.productNameSnapshot ?? item.product?.name ?? '',
      sku: item.product?.sku ?? '',
      modelNo: item.product?.modelNo ?? '',
      specification: item.product?.specification ?? '',
      unit: item.unit ?? item.product?.unit ?? 'PCS',
      quantity: item.quantity,
      unitPrice,
      amount,
      currencyCode: po.currencyCode,
    }
  })

  const totalAmount = items.reduce((s, i) => s + i.amount, 0)

  return NextResponse.json({
    po: {
      id: po.id,
      poNo: po.poNo,
      orderDate: po.orderDate,
      expectedDate: po.expectedDate,
      tradeTerms: po.tradeTerms,
      currencyCode: po.currencyCode,
      status: po.status,
      note: po.note,
    },
    supplier: po.supplier ? {
      id: po.supplier.id,
      name: po.supplier.name,
      address: po.supplier.address,
      city: po.supplier.city,
      countryCode: po.supplier.countryCode,
      contactPerson: po.supplier.contactPerson,
      email: po.supplier.email,
      paymentTerms: po.supplier.paymentTerms,
    } : null,
    company: company ? {
      nameEn: company.nameEn,
      nameZh: company.nameZh,
      addressEn: company.addressEn,
      city: company.city,
      countryCode: company.countryCode,
      phone: company.phone,
      fax: company.fax,
      email: company.email,
      taxId: company.taxId,
      logoBase64: company.logoBase64 ?? null,
    } : null,
    items,
    totals: {
      amount: totalAmount,
      currencyCode: po.currencyCode,
    },
  })
}
