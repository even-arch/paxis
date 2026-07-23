import { PrismaClient, Prisma } from '@prisma/client'
import { extractBaseDocNo } from '@/lib/shipping-marks'

/**
 * 確認出貨並記錄相關財務資訊：
 * 0. 自動幫關聯供應商 PO 補認入庫（見 autoReceiveLinkedPOs 說明）
 * 1. INV_Movement type=4（quantity--, reservedQty--）
 * 2. PO_CustomerCopy_Item.shippedQty 更新
 * 3. FIN_Receivable 建立（AR：應收帳款）
 * 4. PI.status = 2（已出貨）
 *
 * 冪等：已有 type=4 Movement 則跳過 INV 步驟，仍嘗試補建 AR。
 * 供 /api/shipments/[id]/confirm 與批次確認（confirm-all）共用。
 */
export async function confirmShipment(
  prisma: PrismaClient,
  shipmentId: number,
  performedBy: number | null,
): Promise<{ invConfirmed: number; invSkipped: number; arCreated: boolean; poReceiptsCreated: number }> {
  const shipment = await prisma.sLS.findUnique({
    where: { id: shipmentId },
    include: {
      customer: { select: { id: true } },
      items: {
        include: {
          slsItem: { select: { id: true, product: { select: { id: true } } } },
          pi: { select: { id: true } },
        },
      },
      pis: {
        include: {
          pi: {
            select: {
              id: true, piNo: true, orderId: true, totalAmount: true,
              currencyCode: true, extraCharges: true,
              order: {
                select: {
                  id: true, orderNo: true, exchangeRate: true,
                  totalAmount: true, currencyCode: true,
                  items: { select: { id: true, shippedQty: true, quantity: true } },
                },
              },
            },
          },
        },
      },
      stockMovements: { where: { type: 4 }, select: { id: true } },
    },
  })

  if (!shipment) throw new Error('找不到出貨單')

  const invAlreadyDone = shipment.stockMovements.length > 0

  const rawSkuItems = shipment.items.filter(i => !i.slsItem && i.rawSku && i.piId)
  const piItemLookup = new Map<string, number>()

  if (rawSkuItems.length > 0) {
    const piIds = Array.from(new Set(rawSkuItems.map(i => i.piId!)))
    const piItems = await prisma.pI_Item.findMany({
      where: { piId: { in: piIds } },
      select: {
        piId: true,
        slsItem: { select: { id: true, product: { select: { id: true, sku: true } } } },
        product: { select: { id: true, sku: true } },
      },
    })
    for (const pi of piItems) {
      const prod = pi.slsItem?.product ?? pi.product
      if (prod?.sku) piItemLookup.set(`${pi.piId}:${prod.sku}`, prod.id)
    }
  }

  // 每個出貨品項解析出的 productId（供入庫推定與出貨扣庫存共用）
  const resolved = shipment.items.map(item => ({
    item,
    productId: item.slsItem?.product?.id
      ?? (item.piId && item.rawSku ? piItemLookup.get(`${item.piId}:${item.rawSku}`) : undefined),
  }))

  const result = { invConfirmed: 0, invSkipped: 0, arCreated: false, poReceiptsCreated: 0 }

  // ── 0. 自動幫關聯供應商 PO 補認入庫 ──────────────────────────────────
  // 不受 invAlreadyDone 影響：這一步本身就是冪等的（依 receivedQty 還缺多少來算，
  // 已收滿就跳過），所以「補建財務記錄」重新按一次時，之前沒補上的 PO 也會補上。
  result.poReceiptsCreated = await autoReceiveLinkedPOs(prisma, resolved, performedBy)

  // ── 1. INV_Movement type=4 + PO_CustomerCopy_Item.shippedQty ─────────────
  if (invAlreadyDone) {
    result.invSkipped = shipment.items.length
  }
  for (const { item, productId } of invAlreadyDone ? [] : resolved) {
    if (!productId) { result.invSkipped++; continue }

    const stock = await prisma.iNV_Stock.findUnique({ where: { productId } })
    const currentQty = stock?.quantity ?? 0
    const currentReserved = stock?.reservedQty ?? 0
    const reservedDecrement = Math.min(item.quantity, Math.max(0, currentReserved))

    await prisma.iNV_Stock.upsert({
      where: { productId },
      create: { productId, quantity: -item.quantity, reservedQty: 0, safetyStock: 0 },
      update: {
        quantity: { decrement: item.quantity },
        ...(reservedDecrement > 0 ? { reservedQty: { decrement: reservedDecrement } } : {}),
      },
    })

    const updatedStock = await prisma.iNV_Stock.findUnique({ where: { productId } })
    await prisma.iNV_Movement.create({
      data: {
        productId, type: 4,
        qtyDelta: -item.quantity,
        reservedDelta: -reservedDecrement,
        quantityAfter: updatedStock?.quantity ?? currentQty - item.quantity,
        reservedAfter: updatedStock?.reservedQty ?? currentReserved - reservedDecrement,
        slsShipmentId: shipmentId,
        source: 'MANUAL', performedBy,
        patiscoDocId: shipment.patiscoDocId ?? undefined,
        patiscoDocNo: shipment.patiscoDocNo ?? undefined,
      },
    })

    if (item.slsItem?.id) {
      await prisma.pO_CustomerCopy_Item.update({
        where: { id: item.slsItem.id },
        data: { shippedQty: { increment: item.quantity } },
      })
    }
    result.invConfirmed++
  }

  // ── 2. FIN_Receivable（AR）────────────────────────────────────────────
  const existingAR = await prisma.fIN_Receivable.findUnique({ where: { shipmentId } })
  if (!existingAR) {
    const ciRate = Number(shipment.ciExchangeRate ?? 0)

    const calcExtraCharges = (ec: unknown): number => {
      if (!ec || !Array.isArray(ec)) return 1
      let pct = 0
      for (const c of ec as { type?: string; amount?: string }[]) {
        if (c.amount && c.type !== '1') pct += Number(c.amount)
      }
      return 1 + pct / 100
    }

    let amountForeignFromItems = 0
    let itemsWithPrice = 0
    for (const item of shipment.items) {
      const up = (item as unknown as { unitPrice?: { toString(): string } | null }).unitPrice
      if (up != null) {
        amountForeignFromItems += item.quantity * Number(up)
        itemsWithPrice++
      }
    }

    let amountTWD = 0
    let amountForeign = 0

    if (itemsWithPrice > 0 && ciRate > 0) {
      amountForeign = amountForeignFromItems
      amountTWD = amountForeign / ciRate
    } else if (itemsWithPrice > 0) {
      amountForeign = amountForeignFromItems
      amountTWD = amountForeignFromItems
    } else {
      for (const sp of shipment.pis) {
        const totalAmt = sp.pi.totalAmount
        const currCode = sp.pi.currencyCode ?? 'TWD'
        if (!totalAmt) continue
        const base = currCode === 'TWD'
          ? Number(totalAmt)
          : (ciRate > 0 ? Number(totalAmt) / ciRate : Number(totalAmt))
        amountTWD += base * calcExtraCharges(sp.pi.extraCharges)
      }
      amountForeign = ciRate > 0 ? amountTWD * ciRate : amountTWD
    }

    if (amountTWD > 0) {
      const rateAtInvoice = ciRate > 0 ? 1 / ciRate : 1
      const currencyCode = shipment.currencyCode ?? (ciRate > 0 ? 'EUR' : 'TWD')
      await prisma.fIN_Receivable.create({
        data: {
          shipmentId,
          customerId: shipment.customerId ?? undefined,
          currencyCode,
          amountForeign: new Prisma.Decimal(amountForeign),
          rateAtInvoice: new Prisma.Decimal(rateAtInvoice),
          amountTWD: new Prisma.Decimal(amountTWD),
          status: 0,
        },
      })
      result.arCreated = true
    }
  }

  // ── 3. 應付帳款由用戶手工創建（對帳頁面），此處不動 ──────────────────

  // ── 4. PI.status = 2（已出貨）─────────────────────────────────────────
  const piIds = shipment.pis.map(sp => sp.pi.id)
  if (piIds.length > 0) {
    await prisma.pI.updateMany({
      where: { id: { in: piIds }, status: 0 },
      data: { status: 2 },
    })
  }

  return result
}

type ResolvedItem = {
  item: { piId: number | null; quantity: number }
  productId: number | undefined
}

/**
 * 確認出貨時，自動幫關聯供應商 PO 補認「這次出貨用到的量」為已入庫。
 *
 * 背景：我方不可能在供應商的貨還沒到之前，就先把貨出給客戶——所以「已出貨」
 * 這件事本身就是供應商已交貨的鐵證。要求使用者在確認出貨之外，另外再對每張
 * 供應商 PO 分別按一次「入庫確認」，是重複勞動，尤其一次出貨牽涉多家供應商時。
 *
 * 只推定「這次出貨實際用掉的量」，不是整張 PO 全部沖銷——同一張 PO 可能分批
 * 陸續出貨給客戶，還沒用到的量要留著等下次出貨時再推定，不能一次全部認列完。
 *
 * 單價採用 PO 原始下單價（PO_Item.unitPrice），不臆測實際到貨成本是否有出入。
 */
async function autoReceiveLinkedPOs(
  prisma: PrismaClient,
  resolved: ResolvedItem[],
  performedBy: number | null,
): Promise<number> {
  const piIds = Array.from(new Set(resolved.map(r => r.item.piId).filter((id): id is number => id != null)))
  if (piIds.length === 0) return 0

  const pis = await prisma.pI.findMany({
    where: { id: { in: piIds } },
    select: {
      id: true, piNo: true,
      poOrders: {
        select: {
          id: true, poNo: true, supplierId: true,
          items: { select: { id: true, productId: true, quantity: true, receivedQty: true, unitPrice: true } },
        },
      },
    },
  })

  // 需求量：piId -> productId -> 這次出貨用掉的數量（同一 PI+SKU 可能對應多筆出貨品項）
  const neededByPi = new Map<number, Map<number, number>>()
  for (const { item, productId } of resolved) {
    if (item.piId == null || productId == null) continue
    const inner = neededByPi.get(item.piId) ?? new Map<number, number>()
    inner.set(productId, (inner.get(productId) ?? 0) + item.quantity)
    neededByPi.set(item.piId, inner)
  }

  let receiptsCreated = 0

  for (const pi of pis) {
    const needed = neededByPi.get(pi.id)
    if (!needed) continue

    // FK 連結的 PO 之外，同號但編號後面掛了不同尾綴的拆單 PO
    // （如 "E2520149 VL" vs "E2520149 VLG"）不會被 FK 連到，要額外模糊補查，
    // 否則像 JD-053 那樣分散在多張同號 PO 的情況只會補到其中一張。
    const base = extractBaseDocNo(pi.piNo)
    const fuzzyPOs = await prisma.pO.findMany({
      where: { poNo: { startsWith: base } },
      select: {
        id: true, poNo: true, supplierId: true,
        items: { select: { id: true, productId: true, quantity: true, receivedQty: true, unitPrice: true } },
      },
    })
    const seenPoIds = new Set(pi.poOrders.map(po => po.id))
    const poList = [
      ...pi.poOrders,
      ...fuzzyPOs.filter(po => extractBaseDocNo(po.poNo) === base && !seenPoIds.has(po.id)),
    ]

    for (const po of poList) {
      // 這張 PO 裡，哪些品項需要補認入庫、補多少
      const toReceive: Array<{ poItemId: number; productId: number; quantity: number; unitPrice: Prisma.Decimal }> = []
      for (const poItem of po.items) {
        const shippedQty = needed.get(poItem.productId)
        if (!shippedQty) continue
        const remaining = poItem.quantity - poItem.receivedQty
        const qty = Math.min(shippedQty, Math.max(0, remaining))
        if (qty <= 0) continue // 已完成入庫（可能先前已手動按過），不重複認列
        toReceive.push({ poItemId: poItem.id, productId: poItem.productId, quantity: qty, unitPrice: poItem.unitPrice ?? new Prisma.Decimal(0) })
      }
      if (toReceive.length === 0) continue

      const receiptNo = `RCV-${po.poNo}-AUTO-${Date.now().toString().slice(-4)}`
      const receipt = await prisma.pO_Receipt.create({
        data: {
          orderId: po.id,
          receiptNo,
          note: '出貨確認時系統自動推定入庫（供應商已出貨予以認列，未經人工個別確認）',
          source: 'MANUAL',
          performedBy,
          performedAt: new Date(),
          items: { create: toReceive.map(r => ({ poItemId: r.poItemId, quantity: r.quantity })) },
        },
      })
      receiptsCreated++

      for (const r of toReceive) {
        await prisma.pO_Item.update({
          where: { id: r.poItemId },
          data: { receivedQty: { increment: r.quantity } },
        })

        const stock = await prisma.iNV_Stock.upsert({
          where: { productId: r.productId },
          create: { productId: r.productId, quantity: r.quantity, reservedQty: 0, safetyStock: 0 },
          update: { quantity: { increment: r.quantity } },
        })

        await prisma.iNV_Movement.create({
          data: {
            productId: r.productId, type: 1,
            qtyDelta: r.quantity, reservedDelta: 0,
            quantityAfter: stock.quantity, reservedAfter: stock.reservedQty,
            receiptId: receipt.id,
            source: 'MANUAL', performedBy,
            note: `入庫 ${receiptNo}（出貨確認時自動推定）`,
          },
        })

        const product = await prisma.pRD_Product.findUnique({ where: { id: r.productId } })
        if (product) {
          await prisma.pRD_ProductHistory.create({
            data: {
              productId: r.productId,
              name: product.name, sku: product.sku, modelNo: product.modelNo,
              specification: product.specification, unitPerInner: product.unitPerInner,
              unitPerCarton: product.unitPerCarton, cbm: product.cbm,
              grossWeight: product.grossWeight, netWeight: product.netWeight, unit: product.unit,
              unitCost: r.unitPrice,
              sourceType: 'AUTO_RECEIPT_ON_SHIP',
              poOrderId: po.id, poOrderNo: po.poNo,
              changedBy: performedBy ?? 0,
            },
          })
        }
      }

      // 更新 PO 狀態
      const updatedItems = await prisma.pO_Item.findMany({ where: { orderId: po.id } })
      const allReceived = updatedItems.every(i => i.receivedQty >= i.quantity)
      const anyReceived = updatedItems.some(i => i.receivedQty > 0)
      await prisma.pO.update({
        where: { id: po.id },
        data: {
          status: allReceived ? 3 : anyReceived ? 2 : undefined,
          arrivedDate: allReceived ? new Date() : undefined,
        },
      })

      // 應付帳款：比照手動入庫的規則，這張 PO 沒有才建立
      const existingPayable = await prisma.fIN_Payable.findFirst({
        where: { OR: [{ poId: po.id }, { receipt: { orderId: po.id } }] },
        select: { id: true },
      })
      if (!existingPayable) {
        const amountTWD = toReceive.reduce((sum, r) => sum.add(new Prisma.Decimal(r.quantity).mul(r.unitPrice)), new Prisma.Decimal(0))
        const supplier = await prisma.sUP_Supplier.findUnique({
          where: { id: po.supplierId },
          select: { paymentCycleDays: true },
        })
        const dueDate = supplier?.paymentCycleDays
          ? new Date(Date.now() + supplier.paymentCycleDays * 86400000)
          : null
        await prisma.fIN_Payable.create({
          data: { supplierId: po.supplierId, receiptId: receipt.id, amountTWD, dueDate, status: 0 },
        })
      }
    }
  }

  return receiptsCreated
}
