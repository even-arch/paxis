import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

/**
 * POST /api/finance/backfill
 * 從現有出貨單和入庫記錄補建缺失的 FIN_Receivable / FIN_Payable。
 * 冪等：只建立不存在的記錄，不修改已有的。
 */
export async function POST() {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── AR：從 SLS 補建 FIN_Receivable ────────────────────────────
  const shipmentsWithoutReceivable = await prisma.sLS.findMany({
    where: {},
    include: {
      pis: {
        include: {
          pi: {
            select: {
              totalAmount: true,
              currencyCode: true,
              order: {
                select: {
                  customerId: true,
                  currencyCode: true,
                  exchangeRate: true,
                  totalAmount: true,
                },
              },
            },
          },
        },
      },
    },
  })

  let arCreated = 0
  let arSkipped = 0
  let arUpdated = 0

  for (const shipment of shipmentsWithoutReceivable) {
    // 嘗試從 PI.order 或 PI 本身取得金額
    // PI 是主，PO_CustomerCopy 只做 fallback
    const piAmounts = shipment.pis.map(sp => ({
      totalAmount: sp.pi.totalAmount ?? sp.pi.order?.totalAmount,
      currencyCode: sp.pi.currencyCode ?? sp.pi.order?.currencyCode ?? 'TWD',
      orderExchangeRate: sp.pi.order?.exchangeRate ?? null,
      customerId: sp.pi.order?.customerId ?? null,
    })).filter(o => o.totalAmount != null)

    if (piAmounts.length === 0) {
      arSkipped++
      continue
    }

    const ciRate = Number(shipment.ciExchangeRate ?? 0)

    // PI 金額加總：EUR → TWD 用報帳匯率（ciExchangeRate）倒算
    const amountTWD = piAmounts.reduce((s, o) => {
      const amt = Number(o.totalAmount ?? 0)
      if (o.currencyCode === 'TWD') return s + amt
      // ciRate = TWD→EUR（e.g. 0.02717），所以 EUR→TWD = amt / ciRate
      if (ciRate > 0) return s + amt / ciRate
      // fallback：PO_CustomerCopy.exchangeRate（EUR→TWD 方向）
      return s + amt * Number(o.orderExchangeRate ?? 1)
    }, 0)

    if (amountTWD <= 0 || ciRate <= 0) {
      arSkipped++
      continue
    }

    const amountForeign = amountTWD * ciRate          // EUR 金額
    const rateAtInvoice = 1 / ciRate                   // EUR→TWD 匯率（約 36）
    const customerId = shipment.customerId ?? piAmounts.find(o => o.customerId)?.customerId ?? null

    const existing = await prisma.fIN_Receivable.findUnique({ where: { shipmentId: shipment.id } })
    if (existing) {
      await prisma.fIN_Receivable.update({
        where: { shipmentId: shipment.id },
        data: { customerId, currencyCode: 'EUR', amountForeign, rateAtInvoice, amountTWD },
      })
      arUpdated++
    } else {
      await prisma.fIN_Receivable.create({
        data: { shipmentId: shipment.id, customerId, currencyCode: 'EUR', amountForeign, rateAtInvoice, amountTWD, status: 0 },
      })
      arCreated++
    }
  }

  // ── AP：從 SLS_Shipment 補建 FIN_Payable（貿易商模式：出貨 → 付供應商）─────
  // 路徑：SLS → SLS_Item.piId → PI.poOrders(slsPiId) → PO
  // 每張 SLS × 每張 PO 建一筆 FIN_Payable，金額用品項級成本
  const shipments = await prisma.sLS.findMany({
    where: {},
    include: {
      items: {
        select: {
          rawSku: true,
          quantity: true,
          piId: true,
        },
      },
    },
  })

  // 撈出所有 PI 的 PO（含品項單價）
  const allPIs = await prisma.pI.findMany({
    select: {
      id: true,
      poOrders: {
        select: {
          id: true,
          supplierId: true,
          exchangeRate: true,
          currencyCode: true,
          totalAmount: true,
          items: {
            select: {
              product: { select: { sku: true } },
              unitPrice: true,
              quantity: true,
            },
          },
        },
      },
    },
  })

  // 建 costBySku: Map<piId, Map<sku, TWD_unitPrice>>
  const piPoMap = new Map<number, typeof allPIs[0]['poOrders']>()
  for (const pi of allPIs) piPoMap.set(pi.id, pi.poOrders)

  let apCreated = 0
  let apSkipped = 0
  let apUpdated = 0

  for (const shipment of shipments) {
    if (shipment.items.length === 0) { apSkipped++; continue }

    // group items by piId
    const byPi = new Map<number, { rawSku: string; quantity: number }[]>()
    for (const item of shipment.items) {
      if (!item.piId || !item.rawSku) continue
      if (!byPi.has(item.piId)) byPi.set(item.piId, [])
      byPi.get(item.piId)!.push({ rawSku: item.rawSku, quantity: Number(item.quantity) })
    }

    for (const [piId, piItems] of Array.from(byPi)) {
      const pos = piPoMap.get(piId) ?? []
      if (pos.length === 0) continue

      for (const po of pos) {
        // 建 sku→unitPrice map for this PO（TWD 或換算）
        const skuPrice = new Map<string, number>()
        const exRate = Number(po.exchangeRate ?? 1)
        for (const item of po.items) {
          const sku = item.product?.sku
          if (sku && item.unitPrice) skuPrice.set(sku, Number(item.unitPrice) * exRate)
        }

        // 計算本次出貨這張 PO 要付多少
        let amountTWD = 0
        let matched = 0
        for (const { rawSku, quantity } of piItems) {
          const price = skuPrice.get(rawSku)
          if (price != null) { amountTWD += price * quantity; matched++ }
        }

        // 覆蓋率 < 50%：fallback 到 PO 全額（僅限單一 PO 時）
        if (matched === 0 || matched < piItems.length * 0.5) {
          if (pos.length === 1 && po.totalAmount) {
            amountTWD = Number(po.totalAmount) * Number(po.exchangeRate ?? 1)
          } else {
            apSkipped++
            continue
          }
        }

        if (amountTWD <= 0) { apSkipped++; continue }

        const existing = await prisma.fIN_Payable.findUnique({
          where: { shipmentId_poId: { shipmentId: shipment.id, poId: po.id } },
        })
        if (existing) {
          await prisma.fIN_Payable.update({
            where: { id: existing.id },
            data: { supplierId: po.supplierId, amountTWD },
          })
          apUpdated++
        } else {
          await prisma.fIN_Payable.create({
            data: { supplierId: po.supplierId, shipmentId: shipment.id, poId: po.id, amountTWD, status: 0 },
          })
          apCreated++
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    ar: { created: arCreated, updated: arUpdated, skipped: arSkipped },
    ap: { created: apCreated, updated: apUpdated, skipped: apSkipped },
  })
}
