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
      // 客戶資料（直接存在 Shipment 上）
      customer: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          countryCode: true,
          postalCode: true,
          taxId: true,
        },
      },
      // 關聯的所有 PI（帶出 PI 號碼與所屬訂單號，用於追溯）
      pis: {
        include: {
          pi: {
            select: {
              id: true,
              piNo: true,
              order: { select: { id: true, orderNo: true } },
            },
          },
        },
      },
      items: {
        include: {
          slsItem: {
            select: {
              unitPrice: true,
              unit: true,
              product: { select: { name: true, sku: true, specification: true } },
            },
          },
        },
      },
    },
  })

  if (!shipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const totalQty          = shipment.items.reduce((s, i) => s + i.quantity, 0)
  const totalCartons      = shipment.items.reduce((s, i) => s + (i.cartons ?? 0), 0)
  const totalGrossWeightKg = shipment.items.reduce((s, i) => s + (i.grossWeightKg != null ? parseFloat(i.grossWeightKg.toString()) : 0), 0)
  const totalCbm          = shipment.items.reduce((s, i) => s + (i.cbm != null ? parseFloat(i.cbm.toString()) : 0), 0)

  // PI 清單（對外核對用的單據號碼）
  const piList = shipment.pis.map(sp => ({
    piId:    sp.pi.id,
    piNo:    sp.pi.piNo,
    orderId: sp.pi.order.id,
    orderNo: sp.pi.order.orderNo,
  }))

  return NextResponse.json({
    ok: true,
    data: {
      id: shipment.id,
      shipmentNo:      shipment.shipmentNo,
      customerId:      shipment.customerId,
      currencyCode:    shipment.currencyCode,
      // PI 清單取代原本的單一 piId/piNo
      piList,
      // 向下相容：若只有一張 PI，單獨取出方便現有介面使用
      piId:   piList.length === 1 ? piList[0].piId   : null,
      piNo:   piList.length === 1 ? piList[0].piNo   : null,
      orderId: piList.length === 1 ? piList[0].orderId : null,
      orderNo: piList.length === 1 ? piList[0].orderNo : null,
      portOfLoading:   shipment.portOfLoading,
      portOfDischarge: shipment.portOfDischarge,
      shippingMethod:  shipment.shippingMethod,
      trackingNo:      shipment.trackingNo,
      // 收件方（客戶地址）
      recipient: shipment.customer ? {
        name:        shipment.customer.name,
        address:     shipment.customer.address ?? '',
        city:        shipment.customer.city ?? '',
        countryCode: shipment.customer.countryCode ?? '',
        postalCode:  shipment.customer.postalCode ?? '',
        taxId:       shipment.customer.taxId ?? '',
      } : null,
      // 貨物摘要
      totalQty,
      totalCartons:       totalCartons || null,
      totalGrossWeightKg: totalGrossWeightKg || null,
      totalCbm:           totalCbm || null,
      // 品項清單
      items: shipment.items.map(i => ({
        id:            i.id,
        sku:           i.slsItem.product.sku ?? '',
        name:          i.slsItem.product.name,
        specification: i.slsItem.product.specification ?? '',
        quantity:      i.quantity,
        unitPrice:     i.slsItem.unitPrice != null ? parseFloat(i.slsItem.unitPrice.toString()) : null,
        unit:          i.slsItem.unit ?? 'PC',
        cartons:       i.cartons,
        grossWeightKg: i.grossWeightKg != null ? parseFloat(i.grossWeightKg.toString()) : null,
        cbm:           i.cbm != null ? parseFloat(i.cbm.toString()) : null,
      })),
    },
  })
}
