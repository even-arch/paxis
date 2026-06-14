import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, {
  params }: Params) {
  const prisma = await getRequestPrisma()
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const order = await prisma.pO_Order.findUnique({
    where: { id: Number(params.id) },
    include: {
      supplier: true,
      creator: { select: { id: true, name: true } },
      items: {
        include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
      },
      receipts: {
        include: { items: { include: { poItem: true } } },
        orderBy: { performedAt: 'desc' },
      },
    },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}

export async function DELETE(_req: NextRequest, {
  params }: Params) {
  const prisma = await getRequestPrisma()
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  const order = await prisma.pO_Order.findUnique({
    where: { id },
    include: { receipts: { select: { id: true } } },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 已有入庫紀錄：不允許刪除（庫存已異動）
  if (order.receipts.length > 0) {
    return NextResponse.json({ error: '此供應商訂單已有入庫紀錄，無法刪除' }, { status: 400 })
  }

  // 草稿直接刪，已送出視同「取消」
  await prisma.pO_Item.deleteMany({ where: { orderId: id } })
  await prisma.pO_Order.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}

// PATCH：單一欄位更新（不限草稿狀態），目前支援 salesOrderId
export async function PATCH(req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const id = Number(params.id)

  const existing = await prisma.pO_Order.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: Record<string, unknown> = {}
  if ('salesOrderId' in body) {
    data.salesOrderId = body.salesOrderId ? Number(body.salesOrderId) : null
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '沒有可更新的欄位' }, { status: 400 })
  }

  const order = await prisma.pO_Order.update({ where: { id }, data })
  return NextResponse.json(order)
}

export async function PUT(req: NextRequest, {
  params }: Params) {
  const prisma = await getRequestPrisma()
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const id = Number(params.id)

  const existing = await prisma.pO_Order.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // 只有草稿可以編輯
  if (existing.status !== 0) return NextResponse.json({ error: '只有草稿狀態可以編輯' }, { status: 400 })

  const order = await prisma.pO_Order.update({
    where: { id },
    data: {
      supplierId: Number(body.supplierId),
      currencyCode: body.currencyCode,
      exchangeRate: String(body.exchangeRate || '1'),
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
      port: body.port || null,
      shipVia: body.shipVia || null,
      note: body.note || null,
      patiscoOrderNo: body.patiscoOrderNo || null,
      patiscoOrderId: body.patiscoOrderId ? String(body.patiscoOrderId) : null,
    },
  })

  return NextResponse.json(order)
}
