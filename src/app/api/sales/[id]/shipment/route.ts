import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Decimal } from '@prisma/client/runtime/library'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = parseInt((session.user as { id?: string })?.id ?? '', 10)
  const orderId = Number(params.id)
  const { searchParams } = new URL(req.url)
  const shipmentId = Number(searchParams.get('shipmentId'))
  if (!shipmentId) return NextResponse.json({ error: '缺少 shipmentId' }, { status: 400 })

  const shipment = await prisma.sLS_Shipment.findUnique({
    where: { id: shipmentId },
    include: {
      items: {
        include: { slsItem: { select: { id: true, productId: true, orderId: true } } },
      },
      // 取此出貨關聯的所有 PI（判斷哪些 PI 仍有效，以便補回 reservedQty）
      pis: { include: { pi: { select: { id: true, status: true, orderId: true } } } },
    },
  })
  if (!shipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 驗證：出貨的品項中至少有一筆屬於此訂單
  const belongsToOrder = shipment.items.some(si => si.slsItem.orderId === orderId)
  if (!belongsToOrder) return NextResponse.json({ error: '出貨記錄不屬於此訂單' }, { status: 400 })

  // 有效的 PI id set（status=0），用來決定是否要補回 reservedQty
  const activePiIds = Array.from(new Set(shipment.pis.filter(sp => sp.pi.status === 0).map(sp => sp.piId)))

  const now = new Date()

  // 反轉庫存：quantity++，且若此品項有對應有效 PI 則 reservedQty++
  for (const si of shipment.items) {
    const productId = si.slsItem.productId
    // 此品項所屬訂單有沒有有效 PI
    const itemOrderId = si.slsItem.orderId
    const hasActivePiForItem = shipment.pis.some(
      sp => sp.pi.orderId === itemOrderId && sp.pi.status === 0
    )

    const stock = await prisma.iNV_Stock.upsert({
      where: { productId },
      create: { productId, quantity: si.quantity, reservedQty: hasActivePiForItem ? si.quantity : 0, safetyStock: 0 },
      update: {
        quantity: { increment: si.quantity },
        ...(hasActivePiForItem ? { reservedQty: { increment: si.quantity } } : {}),
      },
    })

    await prisma.iNV_Movement.create({
      data: {
        productId,
        type: 6,  // 系統反轉（刪除出貨記錄，自動回補庫存）
        qtyDelta: si.quantity,
        reservedDelta: hasActivePiForItem ? si.quantity : 0,
        quantityAfter: stock.quantity,
        reservedAfter: stock.reservedQty,
        source: 'MANUAL',
        performedBy: userId,
        performedAt: now,
        note: `刪除出貨記錄 ${shipment.shipmentNo}（反轉入庫）`,
      },
    })

    // 還原 SLS_Item 已出貨數
    await prisma.sLS_Item.update({
      where: { id: si.slsItem.id },
      data: { shippedQty: { decrement: si.quantity } },
    })
  }

  // 刪除應收帳款
  await prisma.fIN_Receivable.deleteMany({ where: { shipmentId } })

  // 刪除出貨品項、PI 關聯、出貨記錄（SLS_ShipmentPI cascade delete 會自動處理）
  await prisma.sLS_ShipmentItem.deleteMany({ where: { shipmentId } })
  await prisma.sLS_Shipment.delete({ where: { id: shipmentId } })

  // 重新計算所有受影響訂單的狀態
  const affectedOrderIds = Array.from(new Set(shipment.items.map(si => si.slsItem.orderId)))
  for (const affOrderId of affectedOrderIds) {
    const updatedItems = await prisma.sLS_Item.findMany({ where: { orderId: affOrderId } })
    const anyShipped = updatedItems.some(i => i.shippedQty > 0)
    const hasActivePi = await prisma.sLS_PI.count({ where: { orderId: affOrderId, status: 0 } })
    const newStatus = anyShipped ? 3 : hasActivePi > 0 ? 2 : 1
    await prisma.sLS_Order.update({ where: { id: affOrderId }, data: { status: newStatus } })
  }

  void activePiIds  // suppress unused warning

  return NextResponse.json({ ok: true })
}

type Params = { params: { id: string } }

interface ShipItem {
  slsItemId: number
  quantity: number
  cartons?: number | null
  grossWeightKg?: number | null
  netWeightKg?: number | null
  cbm?: number | null
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = parseInt((session.user as { id?: string })?.id ?? '', 10)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const orderId = Number(params.id)
    const body = await req.json() as {
      // piIds 取代原本的單一 piId；可傳多張同一客戶的 PI
      piIds?: number[]
      actualShipDate: string   // 實際離港日，必填
      shippingMethod?: string | null
      portOfLoading?: string | null
      portOfDischarge?: string | null
      trackingNo?: string | null
      packingListNo?: string | null
      commercialInvNo?: string | null
      ciExchangeRate?: number | null   // CI 出貨匯率（開 Commercial Invoice 時訂定）
      note?: string | null
      source?: string | null   // 'MANUAL' | 'AI_IMPORT' | 'UPS' — 預設 MANUAL
      items: ShipItem[]
    }

    if (!body.actualShipDate) {
      return NextResponse.json({ error: '實際出貨日為必填' }, { status: 400 })
    }
    if (!body.items?.length) {
      return NextResponse.json({ error: '至少需要一項品項' }, { status: 400 })
    }

    // 以 orderId 取出主要訂單（用於驗證客戶、取得幣別）
    const order = await prisma.sLS_Order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        customer: { select: { id: true, collectionCycleDays: true } },
      },
    })

    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (order.status === 5) {
      return NextResponse.json({ error: '此訂單已取消，無法建立出貨記錄' }, { status: 400 })
    }
    if (order.status === 4) {
      return NextResponse.json({ error: `此訂單已完成（全部品項已出貨），若需補錄出貨請先至訂單頁確認。訂單：${order.orderNo}` }, { status: 400 })
    }

    // 驗證 piIds：每張 PI 必須屬於同一個客戶（order.customerId），且狀態有效
    const piIds = body.piIds ?? []
    if (piIds.length > 0) {
      const pis = await prisma.sLS_PI.findMany({
        where: { id: { in: piIds } },
        include: { order: { select: { customerId: true } } },
      })
      for (const pi of pis) {
        if (pi.status !== 0) {
          return NextResponse.json({ error: `PI id=${pi.id} 已取消或不存在` }, { status: 400 })
        }
        if (order.customerId && pi.order.customerId !== order.customerId) {
          return NextResponse.json({ error: `PI id=${pi.id} 不屬於同一個客戶` }, { status: 400 })
        }
      }
    }

    const sourceLabel = body.source ?? 'MANUAL'

    // 產生出貨單號：SHP-YYYYMMDD-XXXX（系統內部識別號，不對外）
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const count = await prisma.sLS_Shipment.count()
    const shipmentNo = `SHP-${datePart}-${String(count + 1).padStart(4, '0')}`

    const now = new Date()
    const actualShipDate = new Date(body.actualShipDate)

    // 建立出貨記錄（含 PI 多對多關聯）
    const shipment = await prisma.sLS_Shipment.create({
      data: {
        customerId:      order.customerId ?? null,
        currencyCode:    order.currencyCode ?? 'USD',
        shipmentNo,
        actualShipDate,
        shippingMethod:  body.shippingMethod ?? null,
        portOfLoading:   body.portOfLoading ?? null,
        portOfDischarge: body.portOfDischarge ?? null,
        trackingNo:      body.trackingNo ?? null,
        packingListNo:   body.packingListNo ?? null,
        commercialInvNo: body.commercialInvNo ?? null,
        ciExchangeRate:  body.ciExchangeRate != null ? new Decimal(body.ciExchangeRate) : null,
        note:            body.note ?? null,
        source:          sourceLabel,
        performedBy:     userId,
        performedAt:     now,
        // PI 多對多
        pis: piIds.length > 0
          ? { create: piIds.map(piId => ({ piId })) }
          : undefined,
        items: {
          create: body.items.map(i => ({
            slsItemId:    i.slsItemId,
            quantity:     i.quantity,
            cartons:      i.cartons ?? null,
            grossWeightKg: i.grossWeightKg != null ? String(i.grossWeightKg) : null,
            netWeightKg:  i.netWeightKg != null ? String(i.netWeightKg) : null,
            cbm:          i.cbm != null ? String(i.cbm) : null,
          })),
        },
      },
    })

    // 更新庫存：quantity-- 一定執行；reservedQty-- 只在有預留量時才扣（防止出現負值）
    for (const shipItem of body.items) {
      const orderItem = order.items.find(i => i.id === shipItem.slsItemId)
      if (!orderItem) continue

      const existingStock = await prisma.iNV_Stock.findUnique({
        where: { productId: orderItem.productId },
        select: { reservedQty: true },
      })
      const currentReserved = existingStock?.reservedQty ?? 0
      const reservedDecrement = Math.min(shipItem.quantity, Math.max(0, currentReserved))

      const stock = await prisma.iNV_Stock.upsert({
        where: { productId: orderItem.productId },
        create: {
          productId: orderItem.productId,
          quantity: -shipItem.quantity,
          reservedQty: 0,
          safetyStock: 0,
        },
        update: {
          quantity: { decrement: shipItem.quantity },
          ...(reservedDecrement > 0 ? { reservedQty: { decrement: reservedDecrement } } : {}),
        },
      })

      await prisma.iNV_Movement.create({
        data: {
          productId:     orderItem.productId,
          type:          4,
          qtyDelta:      -shipItem.quantity,
          reservedDelta: -reservedDecrement,
          quantityAfter: stock.quantity,
          reservedAfter: stock.reservedQty,
          slsShipmentId: shipment.id,
          source:        sourceLabel,
          performedBy:   userId,
          performedAt:   now,
          note:          `出倉 ${shipmentNo}`,
        },
      })

      await prisma.sLS_Item.update({
        where: { id: shipItem.slsItemId },
        data: { shippedQty: { increment: shipItem.quantity } },
      })
    }

    // 更新所有受影響訂單的狀態
    // 品項可能來自多張訂單（多 PI 情況），一一更新
    const affectedOrderIds = Array.from(new Set(
      body.items.map(si => order.items.find(i => i.id === si.slsItemId)?.orderId).filter((id): id is number => id != null)
    ))
    // 確保主訂單也在列
    if (!affectedOrderIds.includes(orderId)) affectedOrderIds.push(orderId)

    for (const affOrderId of affectedOrderIds) {
      const updatedItems = await prisma.sLS_Item.findMany({ where: { orderId: affOrderId } })
      const allShipped = updatedItems.every(i => i.shippedQty >= i.quantity)
      const anyShipped = updatedItems.some(i => i.shippedQty > 0)
      const affOrder = affOrderId === orderId ? order : await prisma.sLS_Order.findUnique({ where: { id: affOrderId } })
      await prisma.sLS_Order.update({
        where: { id: affOrderId },
        data: { status: allShipped ? 4 : anyShipped ? 3 : (affOrder?.status ?? 1) },
      })
    }

    // 自動建立應收帳款
    const shipAmountForeign = body.items.reduce((sum, shipItem) => {
      const orderItem = order.items.find(i => i.id === shipItem.slsItemId)
      if (!orderItem) return sum
      return sum.add(new Decimal(shipItem.quantity).mul(orderItem.unitPrice))
    }, new Decimal(0))

    const exchangeRate = body.ciExchangeRate != null
      ? new Decimal(body.ciExchangeRate)
      : new Decimal(order.exchangeRate || '1')
    const amountTWD = shipAmountForeign.mul(exchangeRate)

    const dueDate = order.customer?.collectionCycleDays
      ? new Date(Date.now() + order.customer.collectionCycleDays * 86400000)
      : null

    await prisma.fIN_Receivable.create({
      data: {
        customerId:    order.customerId ?? null,
        customerName:  order.patiscoBuyerName ?? null,
        shipmentId:    shipment.id,
        currencyCode:  order.currencyCode,
        amountForeign: shipAmountForeign,
        rateAtInvoice: exchangeRate,
        amountTWD,
        dueDate,
        status: 0,
      },
    })

    return NextResponse.json({ ok: true, shipmentNo, shipmentId: shipment.id }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/sales/[id]/shipment]', msg)
    return NextResponse.json({ error: `出貨記錄失敗：${msg}` }, { status: 500 })
  }
}
