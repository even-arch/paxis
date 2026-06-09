import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// 客戶訂單狀態：0=草稿, 1=已確認, 2=PI已發出, 3=部分出貨, 4=完成, 5=取消

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const customerId = searchParams.get('customerId')
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limit = 20

  const where: Record<string, unknown> = {}
  if (customerId) where.customerId = Number(customerId)
  if (search) {
    where.OR = [
      { orderNo: { contains: search } },
      { customer: { name: { contains: search } } },
      { patiscoBuyerName: { contains: search } },
    ]
  }

  const [total, orders] = await Promise.all([
    prisma.sLS_Order.count({ where }),
    prisma.sLS_Order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: { select: { id: true, name: true, shortName: true } },
        _count: { select: { items: true } },
      },
    }),
  ])

  return NextResponse.json({ orders, total, page, totalPages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    customerId?: number | null
    orderNo?: string | null
    patiscoBuyerName?: string | null
    currencyCode: string
    exchangeRate: string
    customerRequestedShipDate?: string | null
    note?: string | null
    source?: string
    patiscoDocId?: string | null
    patiscoDocNo?: string | null
    orderDate?: string | null
    items: {
      productId: number
      quantity: number
      unitPrice: string
      unit?: string | null
      note?: string | null
      productNameSnapshot?: string | null
    }[]
  }

  if (!body.items?.length) {
    return NextResponse.json({ error: '至少需要一項產品' }, { status: 400 })
  }

  // 沿用傳入的單號；沒有才自動產生
  let orderNo = body.orderNo?.trim() || ''
  if (!orderNo) {
    const today = new Date()
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, '')
    const count = await prisma.sLS_Order.count()
    orderNo = `SLS-${datePart}-${String(count + 1).padStart(4, '0')}`
  }

  const order = await prisma.sLS_Order.create({
    data: {
      orderNo,
      customerId: body.customerId ?? null,
      patiscoBuyerName: body.patiscoBuyerName ?? null,
      orderDate: body.orderDate ? new Date(body.orderDate) : null,
      status: 1, // 直接設為「已確認」（AI 匯入或手動建立都是確認狀態）
      currencyCode: body.currencyCode,
      exchangeRate: body.exchangeRate || '1',
      customerRequestedShipDate: body.customerRequestedShipDate
        ? new Date(body.customerRequestedShipDate)
        : null,
      note: body.note ?? null,
      source: body.source ?? 'MANUAL',
      performedBy: Number(session.user.id),
      performedAt: new Date(),
      patiscoDocId: body.patiscoDocId ?? null,
      patiscoDocNo: body.patiscoDocNo ?? null,
      createdBy: Number(session.user.id),
      items: {
        create: body.items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          unit: i.unit ?? null,
          note: i.note ?? null,
          productNameSnapshot: i.productNameSnapshot ?? null,
        })),
      },
    },
  })

  // 自動維護客戶-商品關係（訂單已成立 = 確認此客戶有購買這些 SKU）
  if (body.customerId && body.items.length > 0) {
    const now = new Date()
    // 先取建立後的 items（含 id），批次 upsert
    const createdItems = await prisma.sLS_Item.findMany({
      where: { orderId: order.id },
    })
    await Promise.allSettled(
      createdItems.map(item =>
        prisma.cUS_CustomerProduct.upsert({
          where: { customerId_productId: { customerId: body.customerId!, productId: item.productId } },
          create: {
            customerId: body.customerId!,
            productId: item.productId,
            lastUnitPrice: item.unitPrice,
            currencyCode: body.currencyCode ?? null,
            lastOrderDate: now,
            orderCount: 1,
          },
          update: {
            lastUnitPrice: item.unitPrice,
            currencyCode: body.currencyCode ?? null,
            lastOrderDate: now,
            orderCount: { increment: 1 },
            updatedAt: now,
          },
        })
      )
    )
  }

  return NextResponse.json(order, { status: 201 })
}
