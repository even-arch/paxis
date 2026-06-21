import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { Prisma } from '@prisma/client'

/**
 * POST /api/shipments/[id]/confirm
 * 驅動出貨的連鎖反應：
 * 1. INV_Movement type=4（quantity--, reservedQty--）
 * 2. PO_CustomerCopy_Item.shippedQty 更新
 * 3. FIN_Receivable 建立（AR：等客戶付款）
 * 4. FIN_Payable 建立（AP：若 PO_Receipt 已存在）
 * 冪等保護：已有 type=4 Movement 則拒絕重複。
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = parseInt(params.id, 10)
  if (isNaN(shipmentId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const performedBy = (() => {
    const uid = ((session.user as unknown) as { id?: unknown }).id
    return uid != null ? parseInt(String(uid), 10) : null
  })()

  // ── 讀取出貨單完整資料 ──────────────────────────────────────────────────
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

  if (!shipment) return NextResponse.json({ error: '找不到出貨單' }, { status: 404 })

  // 若 INV 已扣過，跳過 INV 步驟但仍繼續建 AR/AP（補建財務記錄）
  const invAlreadyDone = shipment.stockMovements.length > 0

  // ── 補查 rawSku → productId ──────────────────────────────────────────
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

  const result = { invConfirmed: 0, invSkipped: 0, arCreated: false, apCreated: 0, apSkipped: 0 }

  try {
    // ── 1. INV_Movement type=4 + PO_CustomerCopy_Item.shippedQty ─────────────────────
    if (invAlreadyDone) {
      result.invSkipped = shipment.items.length
    }
    for (const item of invAlreadyDone ? [] : shipment.items) {
      const productId = item.slsItem?.product?.id
        ?? (item.piId && item.rawSku ? piItemLookup.get(`${item.piId}:${item.rawSku}`) : undefined)

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

      // PO_CustomerCopy_Item.shippedQty 更新
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

      // AR = PI 金額加總（PI 是主，PO_CustomerCopy 只做 fallback）
      let amountTWD = 0
      for (const sp of shipment.pis) {
        const totalAmt = sp.pi.totalAmount
        const currCode = sp.pi.currencyCode ?? 'TWD'
        if (!totalAmt) continue
        const base = currCode === 'TWD'
          ? Number(totalAmt)
          : (ciRate > 0 ? Number(totalAmt) / ciRate : Number(totalAmt))
        amountTWD += base * calcExtraCharges(sp.pi.extraCharges)
      }

      if (amountTWD > 0) {
        // ciRate=0 時（尚未同步 CI 文件），先用外幣金額原值存入，等待後續更新
        const amountForeign = ciRate > 0 ? amountTWD * ciRate : amountTWD
        const rateAtInvoice = ciRate > 0 ? 1 / ciRate : 1
        const currencyCode = ciRate > 0 ? 'EUR' : (shipment.pis[0]?.pi.currencyCode ?? 'TWD')
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

    // ── 3. FIN_Payable（AP）：找出此出貨關聯的 PO ─────────────────
    // 主路徑 A：PO.slsPiId → PI.id（正式 FK，最可靠）
    // 主路徑 B：PO.poNo = PI.piNo（號碼相同時的 fallback）
    // 次路徑：PO.salesOrderId → PO_CustomerCopy（最後手段，有 PO_CustomerCopy 連結時）
    const allPiIds = shipment.pis.map(sp => sp.pi.id)
    const allPiNos = shipment.pis.map(sp => sp.pi.piNo)
    const slsOrderIds = shipment.pis
      .map(sp => sp.pi.order?.id)
      .filter((id): id is number => id != null)

    const poOrderConditions: Record<string, unknown>[] = []
    if (allPiIds.length > 0) poOrderConditions.push({ slsPiId: { in: allPiIds } })
    if (allPiNos.length > 0) poOrderConditions.push({ poNo: { in: allPiNos } })
    if (slsOrderIds.length > 0) poOrderConditions.push({ salesOrderId: { in: slsOrderIds } })

    if (poOrderConditions.length > 0) {
      const poOrders = await prisma.pO.findMany({
        where: { OR: poOrderConditions },
        include: {
          receipts: { take: 1 },
          supplier: { select: { id: true } },
        },
      })

      for (const po of poOrders) {
        let receipt = po.receipts[0]

        // 貿易商模式：沒有入庫記錄時，以出貨日自動建立虛擬 PO_Receipt
        if (!receipt) {
          const receiptNo = `VIRTUAL-${shipment.shipmentNo}-${po.id}`
          receipt = await prisma.pO_Receipt.create({
            data: {
              orderId: po.id,
              receiptNo,
              receiptDate: shipment.actualShipDate ?? new Date(),
              source: 'MANUAL',
              performedBy,
              note: `貿易商出貨自動建立（出貨單 ${shipment.shipmentNo}）`,
            },
          })
        }

        const existing = await prisma.fIN_Payable.findUnique({ where: { receiptId: receipt.id } })
        if (existing) continue

        const base = po.totalAmount ? Number(po.totalAmount) : 0
        const amountTWD = base * Number(po.exchangeRate ?? 1)
        if (amountTWD <= 0) { result.apSkipped++; continue }

        await prisma.fIN_Payable.create({
          data: {
            supplierId: po.supplierId,
            receiptId: receipt.id,
            amountTWD: new Prisma.Decimal(amountTWD),
            status: 0,
          },
        })
        result.apCreated++
      }
    }

    // ── 4. PI.status = 2（已出貨）────────────────────────────────────
    const piIds = shipment.pis.map(sp => sp.pi.id)
    if (piIds.length > 0) {
      await prisma.pI.updateMany({
        where: { id: { in: piIds }, status: 0 },
        data: { status: 2 },
      })
    }

  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...result })
}
