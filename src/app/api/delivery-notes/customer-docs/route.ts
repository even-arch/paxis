import { NextRequest, NextResponse } from 'next/server'
import { getRequestPrisma } from '@/lib/request-db'

export async function GET(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const customerId = parseInt(req.nextUrl.searchParams.get('customerId') ?? '', 10)
  if (isNaN(customerId)) return NextResponse.json({ pis: [], orders: [] })

  const [pis, orders] = await Promise.all([
    // 未出貨的 PI（沒有對應 SLS 的）
    prisma.pI.findMany({
      where: {
        order: { customerId },
        shipmentPIs: { none: {} },
        deliveryNotes: { none: {} },
      },
      select: {
        id: true, piNo: true, performedAt: true,
        items: {
          include: { slsItem: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } } },
        },
      },
      orderBy: { performedAt: 'desc' },
      take: 50,
    }),
    // 未出貨的 PO_CustomerCopy
    prisma.pO_CustomerCopy.findMany({
      where: {
        customerId,
        deliveryNotes: { none: {} },
      },
      select: {
        id: true, orderNo: true,
        items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  return NextResponse.json({
    pis: pis.map(pi => ({
      id: pi.id,
      piNo: pi.piNo,
      items: pi.items.map((i: { quantity: number; slsItem: { product: { id: number; sku: string | null; name: string; unit: string | null } | null; quantity: number } | null }) => ({
        product: i.slsItem?.product ?? null,
        quantity: i.quantity,
      })),
    })),
    orders: orders.map(o => ({
      id: o.id,
      orderNo: o.orderNo,
      items: o.items.map(i => ({
        product: i.product ?? null,
        quantity: i.quantity,
      })),
    })),
  })
}
