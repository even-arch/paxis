import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import {
  PLATFORM_LABELS,
  assessCommerceOrder,
  findMockMarketplaceOrder,
  type CommerceOrder,
  type CommerceProductSnapshot,
} from '@/modules/commerce/mockMarketplace'

type Params = { params: { orderId: string } }

function buildOrderNote(order: CommerceOrder) {
  return [
    `電商平台：${PLATFORM_LABELS[order.platform]}`,
    `平台帳號：${order.accountName}`,
    `平台訂單：${order.platformOrderNo}`,
    `消費者：${order.consumer.name} / ${order.consumer.phone} / ${order.consumer.email}`,
    `收件地址：${order.shippingAddress.zipCode} ${order.shippingAddress.city}${order.shippingAddress.district}${order.shippingAddress.address}`,
    `物流偏好：${order.carrierPreference}`,
  ].join('\n')
}

export async function POST(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = Number(session.user.id)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const products = await prisma.pRD_Product.findMany({
    where: { isActive: true },
    orderBy: [{ isAvailableForPos: 'desc' }, { createdAt: 'desc' }],
    take: 12,
    select: {
      id: true,
      name: true,
      sku: true,
      unit: true,
      sellingPrice: true,
      inventoryItems: { select: { quantity: true, reservedQty: true } },
    },
  })

  const snapshots: CommerceProductSnapshot[] = products.map(product => {
    const stock = product.inventoryItems[0]
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      sellingPrice: product.sellingPrice?.toString() ?? null,
      quantity: stock?.quantity ?? 0,
      reservedQty: stock?.reservedQty ?? 0,
    }
  })

  const order = findMockMarketplaceOrder(params.orderId, snapshots)
  if (!order) return NextResponse.json({ error: '找不到平台訂單' }, { status: 404 })

  const existing = await prisma.sLS_Order.findUnique({
    where: { orderNo: order.platformOrderNo },
    select: { id: true, orderNo: true },
  })
  if (existing) {
    return NextResponse.json({ ok: true, orderId: existing.id, alreadyImported: true })
  }

  const assessment = assessCommerceOrder(order)
  if (!assessment.canImport) {
    return NextResponse.json({
      error: '庫存不足，無法匯入並預留',
      insufficientItems: assessment.insufficientItems,
    }, { status: 409 })
  }

  const now = new Date()
  const piNo = `ECOM-RES-${order.platformOrderNo}`

  const result = await prisma.$transaction(async tx => {
    const customer = await tx.cUS_Customer.findFirst({
      where: {
        isActive: true,
        OR: [
          { email: order.consumer.email },
          { phoneNo: order.consumer.phone },
        ],
      },
      select: { id: true },
    }) ?? await tx.cUS_Customer.create({
      data: {
        name: order.consumer.name,
        shortName: order.consumer.name,
        address: `${order.shippingAddress.city}${order.shippingAddress.district}${order.shippingAddress.address}`,
        city: order.shippingAddress.city,
        countryCode: 'TW',
        postalCode: order.shippingAddress.zipCode,
        phoneNo: order.consumer.phone,
        email: order.consumer.email,
        contactPerson: order.consumer.name,
        currencyCode: 'TWD',
        note: `${PLATFORM_LABELS[order.platform]} 消費者：${order.platformOrderNo}`,
      },
      select: { id: true },
    })

    const slsOrder = await tx.sLS_Order.create({
      data: {
        orderNo: order.platformOrderNo,
        customerId: customer.id,
        status: 2,
        currencyCode: 'TWD',
        exchangeRate: '1',
        totalAmount: order.totalAmount,
        customerRequestedShipDate: new Date(order.shipBy),
        customerPoNo: order.platformOrderNo,
        note: buildOrderNote(order),
        source: 'MARKETPLACE',
        performedBy: userId,
        performedAt: now,
        createdBy: userId,
      },
    })

    const createdItems = []
    for (const item of order.items) {
      const slsItem = await tx.sLS_Item.create({
        data: {
          orderId: slsOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unit: item.unit,
          customerSkuRef: item.sku,
          note: `${PLATFORM_LABELS[order.platform]} ${item.platformItemId}`,
        },
      })
      createdItems.push({ commerceItem: item, slsItem })
    }

    const pi = await tx.sLS_PI.create({
      data: {
        orderId: slsOrder.id,
        piNo,
        estimatedShipDate: new Date(order.shipBy),
        status: 0,
        source: 'MARKETPLACE',
        performedBy: userId,
        performedAt: now,
      },
    })

    for (const item of createdItems) {
      await tx.sLS_PIItem.create({
        data: {
          piId: pi.id,
          slsItemId: item.slsItem.id,
          quantity: item.commerceItem.quantity,
          unitPrice: item.commerceItem.unitPrice,
          unit: item.commerceItem.unit,
        },
      })

      const stock = await tx.iNV_Stock.upsert({
        where: { productId: item.commerceItem.productId },
        create: {
          productId: item.commerceItem.productId,
          quantity: 0,
          reservedQty: item.commerceItem.quantity,
          safetyStock: 0,
        },
        update: {
          reservedQty: { increment: item.commerceItem.quantity },
        },
      })

      await tx.iNV_Movement.create({
        data: {
          productId: item.commerceItem.productId,
          type: 2,
          qtyDelta: 0,
          reservedDelta: item.commerceItem.quantity,
          quantityAfter: stock.quantity,
          reservedAfter: stock.reservedQty,
          slsPiId: pi.id,
          source: 'MARKETPLACE',
          performedBy: userId,
          performedAt: now,
          note: `電商訂單預留 ${order.platformOrderNo}`,
        },
      })
    }

    return { orderId: slsOrder.id, piId: pi.id, piNo }
  })

  return NextResponse.json({ ok: true, ...result }, { status: 201 })
}
