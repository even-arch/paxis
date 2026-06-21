import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function GET(
  _req: NextRequest,
  { params }: { params: { piId: string } }
) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const piId = Number(params.piId)
  if (isNaN(piId)) return NextResponse.json({ error: 'Invalid piId' }, { status: 400 })

  const pi = await prisma.pI.findUnique({
    where: { id: piId },
    include: {
      order: { include: { customer: true } },
      customer: true,
      items: {
        include: {
          slsItem: {
            include: {
              product: {
                select: {
                  name: true, sku: true, modelNo: true, specification: true, unit: true,
                  unitPerCarton: true, cbm: true, grossWeight: true, netWeight: true, countryOfOrigin: true,
                },
              },
            },
          },
          product: {
            select: {
              name: true, sku: true, modelNo: true, specification: true, unit: true,
              unitPerCarton: true, cbm: true, grossWeight: true, netWeight: true, countryOfOrigin: true,
            },
          },
        },
      },
    },
  })

  if (!pi) return NextResponse.json({ error: 'PI not found' }, { status: 404 })

  const company = await prisma.sYS_Company.findFirst()

  const tradeTermsMap: Record<number, string> = {
    13: 'FOB',
    14: 'FOR',
    1:  'EXW',
    2:  'FCA',
    3:  'CPT',
    4:  'CIP',
    5:  'CFR',
    6:  'CIF',
    7:  'DAT',
    8:  'DAP',
    9:  'DDP',
  }

  const orderCustomer = pi.order?.customer ?? pi.customer
  const items = pi.items.map(item => {
    const product = item.slsItem?.product ?? item.product
    const unitPrice = Number(item.unitPrice ?? item.slsItem?.unitPrice ?? 0)
    const qty = item.quantity
    const amount = unitPrice * qty
    return {
      productName: item.slsItem?.productNameSnapshot ?? product?.name ?? '',
      sku: product?.sku ?? '',
      modelNo: product?.modelNo ?? '',
      specification: product?.specification ?? '',
      unit: item.unit ?? product?.unit ?? 'PCS',
      unitPerCarton: item.unitPerCarton ?? product?.unitPerCarton ?? null,
      cbm: Number(item.cbm ?? product?.cbm ?? 0) || null,
      grossWeightKg: Number(item.grossWeight ?? product?.grossWeight ?? 0) || null,
      netWeightKg: Number(item.netWeight ?? product?.netWeight ?? 0) || null,
      countryOfOrigin: product?.countryOfOrigin ?? '',
      quantity: qty,
      unitPrice,
      amount,
      currencyCode: pi.order?.currencyCode ?? pi.currencyCode ?? '',
    }
  })

  const totalAmount = items.reduce((s, i) => s + i.amount, 0)
  const totalCartons = items.reduce((s, i) => s + (i.unitPerCarton ? Math.ceil(i.quantity / i.unitPerCarton) : 0), 0)
  const totalGrossWeight = items.reduce((s, i) => s + (i.grossWeightKg ? i.grossWeightKg * i.quantity : 0), 0)
  const totalCbm = items.reduce((s, i) => s + (i.cbm ? i.cbm * (i.unitPerCarton ? Math.ceil(i.quantity / i.unitPerCarton) : 1) : 0), 0)

  return NextResponse.json({
    pi: {
      id: pi.id,
      piNo: pi.piNo,
      piDate: pi.piDate,
      estimatedShipDate: pi.estimatedShipDate,
      etd: pi.etd,
      tradeTerms: pi.tradeTermsCode ? (tradeTermsMap[pi.tradeTermsCode] ?? String(pi.tradeTermsCode)) : null,
      status: pi.status,
    },
    order: {
      orderNo: pi.order?.orderNo ?? null,
      customerPoNo: pi.order?.customerPoNo ?? null,
      currencyCode: pi.order?.currencyCode ?? pi.currencyCode ?? '',
      paymentTerms: orderCustomer?.paymentTerms ?? null,
    },
    customer: orderCustomer ? {
      id: orderCustomer.id,
      name: orderCustomer.name,
      shortName: orderCustomer.shortName,
      address: orderCustomer.address,
      city: orderCustomer.city,
      countryCode: orderCustomer.countryCode,
      email: orderCustomer.email,
      contactPerson: orderCustomer.contactPerson,
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
      bankName: company.bankName,
      bankAccount: company.bankAccount,
      bankSwift: company.bankSwift,
      logoBase64: company.logoBase64 ?? null,
    } : null,
    items,
    totals: {
      amount: totalAmount,
      cartons: totalCartons || null,
      grossWeightKg: totalGrossWeight || null,
      cbm: totalCbm || null,
      currencyCode: pi.order?.currencyCode ?? pi.currencyCode ?? '',
    },
  })
}
