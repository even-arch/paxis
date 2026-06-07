/**
 * GET /api/shipments/[id]
 * 取得單一 SLS_Shipment 的完整資料，供 /shipping 頁面預填使用
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const shipment = await prisma.sLS_Shipment.findUnique({
    where: { id },
    include: {
      order: {
        select: {
          id: true,
          orderNo: true,
          currencyCode: true,
          customer: {
            select: {
              name: true,
              address: true,
              city: true,
              countryCode: true,
              postalCode: true,
              taxId: true,
            },
          },
        },
      },
      pi: { select: { id: true, piNo: true } },
      items: {
        include: {
          slsItem: {
            include: {
              product: { select: { name: true, sku: true, specification: true } },
            },
          },
        },
      },
    },
  })

  if (!shipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 計算總量 (估算)
  const totalQty = shipment.items.reduce((s, i) => s + i.quantity, 0)
  const totalCartons = shipment.items.reduce((s, i) => s + (i.cartons ?? 0), 0)
  const totalGrossWeightKg = shipment.items.reduce((s, i) => {
    return s + (i.grossWeightKg != null ? parseFloat(i.grossWeightKg.toString()) : 0)
  }, 0)
  const totalCbm = shipment.items.reduce((s, i) => {
    return s + (i.cbm != null ? parseFloat(i.cbm.toString()) : 0)
  }, 0)

  const customer = shipment.order.customer

  return NextResponse.json({
    ok: true,
    data: {
      id: shipment.id,
      shipmentNo: shipment.shipmentNo,
      orderId: shipment.order.id,
      orderNo: shipment.order.orderNo,
      currencyCode: shipment.order.currencyCode,
      piId: shipment.pi?.id ?? null,
      piNo: shipment.pi?.piNo ?? null,
      portOfLoading: shipment.portOfLoading,
      portOfDischarge: shipment.portOfDischarge,
      shippingMethod: shipment.shippingMethod,
      trackingNo: shipment.trackingNo,
      // 收件方（客戶地址）
      recipient: customer ? {
        name: customer.name,
        address: customer.address ?? '',
        city: customer.city ?? '',
        countryCode: customer.countryCode ?? '',
        postalCode: customer.postalCode ?? '',
        taxId: customer.taxId ?? '',
      } : null,
      // 貨物摘要
      totalQty,
      totalCartons: totalCartons || null,
      totalGrossWeightKg: totalGrossWeightKg || null,
      totalCbm: totalCbm || null,
      // 品項清單
      items: shipment.items.map(i => ({
        id: i.id,
        sku: i.slsItem.product.sku ?? '',
        name: i.slsItem.product.name,
        specification: i.slsItem.product.specification ?? '',
        quantity: i.quantity,
        cartons: i.cartons,
        grossWeightKg: i.grossWeightKg != null ? parseFloat(i.grossWeightKg.toString()) : null,
        cbm: i.cbm != null ? parseFloat(i.cbm.toString()) : null,
      })),
    },
  })
}
