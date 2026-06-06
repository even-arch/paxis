import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notifyInventoryUpdate } from '@/api/patisco/client'
import { Decimal } from '@prisma/client/runtime/library'

type Params = { params: { id: string } }

interface ReceiveItem {
  poItemId: number
  quantity: number
  unitCost?: number   // 實際入庫成本（可能與 PO 略有出入）
  currency?: string   // 幣別
}

export async function POST(req: NextRequest, {
  params }: Params) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = parseInt((session.user as { id?: string })?.id ?? '', 10)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const orderId = Number(params.id)

  const order = await prisma.pO_Order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.status === 3 || order.status === 4)
    return NextResponse.json({ error: '此供應商訂單已完成或取消' }, { status: 400 })

  const receiveItems: ReceiveItem[] = body.items ?? []
  if (receiveItems.length === 0)
    return NextResponse.json({ error: '請輸入入庫數量' }, { status: 400 })

  const receiptNo = `RCV-${order.poNo}-${Date.now().toString().slice(-4)}`

  const receipt = await prisma.pO_Receipt.create({
    data: {
      orderId,
      receiptNo,
      note: body.note || null,
      source: 'MANUAL',
      performedBy: userId,
      performedAt: new Date(),
      items: {
        create: receiveItems.map(i => ({
          poItemId: i.poItemId,
          quantity: i.quantity,
        })),
      },
    },
  })

  const patiscoNotifications: Array<Promise<unknown>> = []

  for (const item of receiveItems) {
    const poItem = order.items.find(i => i.id === item.poItemId)
    if (!poItem) continue

    await prisma.pO_Item.update({
      where: { id: item.poItemId },
      data: { receivedQty: { increment: item.quantity } },
    })

    // 計算新的加權平均成本（WAC）
    const currentStock = await prisma.iNV_Stock.findUnique({
      where: { productId: poItem.productId },
    })

    const incomingCost = item.unitCost != null ? new Decimal(item.unitCost) : poItem.unitPrice
    let newAvgCost: Decimal | null = null

    if (incomingCost) {
      const currentQty = currentStock?.quantity ?? 0
      const currentAvg = currentStock?.avgUnitCost ?? new Decimal(0)
      // WAC = (現有庫存×現有平均成本 + 入庫數量×入庫成本) / (現有庫存 + 入庫數量)
      const totalQty = currentQty + item.quantity
      newAvgCost = totalQty > 0
        ? new Decimal(currentQty).mul(currentAvg).add(new Decimal(item.quantity).mul(incomingCost)).div(totalQty)
        : incomingCost
    }

    // 更新庫存
    const stock = await prisma.iNV_Stock.upsert({
      where: { productId: poItem.productId },
      create: {
        productId: poItem.productId,
        quantity: item.quantity,
        reservedQty: 0,
        safetyStock: 0,
        avgUnitCost: newAvgCost,
      },
      update: {
        quantity: { increment: item.quantity },
        ...(newAvgCost !== null ? { avgUnitCost: newAvgCost } : {}),
      },
    })

    // 寫庫存異動紀錄
    await prisma.iNV_Movement.create({
      data: {
        productId: poItem.productId,
        type: 1,
        qtyDelta: item.quantity,
        reservedDelta: 0,
        quantityAfter: stock.quantity,
        reservedAfter: stock.reservedQty,
        avgUnitCostAfter: newAvgCost,
        receiptId: receipt.id,
        source: 'MANUAL',
        performedBy: userId,
        performedAt: new Date(),
        note: `入庫 ${receiptNo}`,
      },
    })

    // 寫產品歷史快照
    await prisma.pRD_ProductHistory.create({
      data: {
        productId: poItem.productId,
        name: poItem.product.name,
        sku: poItem.product.sku,
        modelNo: poItem.product.modelNo,
        specification: poItem.product.specification,
        unitPerInner: poItem.product.unitPerInner,
        unitPerCarton: poItem.product.unitPerCarton,
        cbm: poItem.product.cbm,
        grossWeight: poItem.product.grossWeight,
        netWeight: poItem.product.netWeight,
        unit: poItem.product.unit ?? poItem.unit,
        unitCost: incomingCost,
        currency: item.currency ?? order.currencyCode,
        sourceType: 'PO_RECEIPT',
        poOrderId: orderId,
        poOrderNo: order.poNo,
        changedBy: userId,
      },
    })

    if (poItem.product.patiscoProductId) {
      patiscoNotifications.push(
        notifyInventoryUpdate({
          productId: poItem.productId,
          patiscoProductId: String(poItem.product.patiscoProductId),
          quantity: stock.quantity,
        }).catch(() => {})
      )
    }
  }

  // 更新供應商訂單狀態
  const updatedItems = await prisma.pO_Item.findMany({ where: { orderId } })
  const allReceived = updatedItems.every(i => i.receivedQty >= i.quantity)
  const anyReceived = updatedItems.some(i => i.receivedQty > 0)

  await prisma.pO_Order.update({
    where: { id: orderId },
    data: {
      status: allReceived ? 3 : anyReceived ? 2 : order.status,
      arrivedDate: allReceived ? new Date() : undefined,
    },
  })

  // 自動建立應付帳款
  const receiptAmountTWD = receiveItems.reduce((sum, item) => {
    const poItem = order.items.find(i => i.id === item.poItemId)
    if (!poItem) return sum
    const cost = item.unitCost != null ? new Decimal(item.unitCost) : poItem.unitPrice
    return sum.add(new Decimal(item.quantity).mul(cost))
  }, new Decimal(0))

  const supplier = await prisma.sUP_Supplier.findUnique({
    where: { id: order.supplierId },
    select: { paymentCycleDays: true },
  })
  const dueDate = supplier?.paymentCycleDays
    ? new Date(Date.now() + supplier.paymentCycleDays * 86400000)
    : null

  await prisma.fIN_Payable.create({
    data: {
      supplierId: order.supplierId,
      receiptId: receipt.id,
      amountTWD: receiptAmountTWD,
      dueDate,
      status: 0,
    },
  })

  Promise.all(patiscoNotifications).catch(() => {})

  return NextResponse.json({ ok: true, receiptNo, receiptId: receipt.id })
}
