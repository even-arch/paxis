import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function GET(
  _req: NextRequest,
  { params }: { params: { shipmentId: string } }
) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = Number(params.shipmentId)
  if (isNaN(shipmentId)) return NextResponse.json({ error: 'Invalid shipmentId' }, { status: 400 })

  const shipment = await prisma.sLS.findUnique({
    where: { id: shipmentId },
    include: {
      customer: true,
      pis: {
        include: {
          pi: {
            select: { piNo: true, id: true },
          },
        },
      },
      items: {
        include: {
          slsItem: {
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
          pi: {
            select: { piNo: true },
          },
        },
      },
    },
  })

  if (!shipment) return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })

  const company = await prisma.sYS_Company.findFirst()

  // 取得品項金額：從關聯的 PO_CustomerCopy_Item 取單價
  const items = shipment.items.map(item => {
    const product = item.slsItem?.product
    const unitPrice = Number(item.slsItem?.unitPrice ?? 0)
    const quantity = item.quantity
    const amount = unitPrice * quantity
    return {
      productName: item.rawProductName ?? item.slsItem?.productNameSnapshot ?? product?.name ?? '',
      sku: item.rawSku ?? product?.sku ?? '',
      modelNo: product?.modelNo ?? '',
      specification: product?.specification ?? '',
      unit: product?.unit ?? 'PCS',
      quantity,
      cartons: item.cartons ?? null,
      cartonNoFrom: item.cartonNoFrom ?? null,
      cartonNoTo: item.cartonNoTo ?? null,
      grossWeightKg: item.grossWeightKg ? Number(item.grossWeightKg) : null,
      netWeightKg: item.netWeightKg ? Number(item.netWeightKg) : null,
      cbm: item.cbm ? Number(item.cbm) : null,
      unitPrice,
      amount,
      piNo: item.pi?.piNo ?? null,
    }
  })

  const totalCartons = items.reduce((s, i) => s + (i.cartons ?? 0), 0)
  const totalGrossWeight = items.reduce((s, i) => s + (i.grossWeightKg ?? 0), 0)
  const totalNetWeight = items.reduce((s, i) => s + (i.netWeightKg ?? 0), 0)
  const totalCbm = items.reduce((s, i) => s + (i.cbm ?? 0), 0)
  const totalAmount = items.reduce((s, i) => s + i.amount, 0)

  const piNos = shipment.pis.map(p => p.pi.piNo).join(', ')

  return NextResponse.json({
    shipment: {
      id: shipment.id,
      shipmentNo: shipment.shipmentNo,
      packingListNo: shipment.packingListNo,
      commercialInvNo: shipment.commercialInvNo,
      actualShipDate: shipment.actualShipDate,
      shippingMethod: shipment.shippingMethod,
      portOfLoading: shipment.portOfLoading,
      portOfDischarge: shipment.portOfDischarge,
      trackingNo: shipment.trackingNo,
      currencyCode: shipment.currencyCode ?? 'USD',
      piNos,
    },
    customer: shipment.customer ? {
      id: shipment.customer.id,
      name: shipment.customer.name,
      address: shipment.customer.address,
      city: shipment.customer.city,
      countryCode: shipment.customer.countryCode,
      contactPerson: shipment.customer.contactPerson,
      email: shipment.customer.email,
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
      cartons: totalCartons || null,
      grossWeightKg: totalGrossWeight || null,
      netWeightKg: totalNetWeight || null,
      cbm: totalCbm || null,
      amount: totalAmount,
      currencyCode: shipment.currencyCode ?? 'USD',
    },
  })
}
