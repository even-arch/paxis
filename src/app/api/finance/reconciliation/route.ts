import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function GET() {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 所有 PI（含品項承諾數量）
  const pis = await prisma.pI.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      piNo: true,
      currencyCode: true,
      totalAmount: true,
      status: true,
      customerId: true,
      customer: { select: { name: true, shortName: true } },
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          product: { select: { sku: true, name: true } },
        },
      },
      shipmentPIs: {
        select: {
          shipment: {
            select: {
              id: true,
              shipmentNo: true,
              actualShipDate: true,
              ciExchangeRate: true,
            },
          },
        },
      },
    },
    orderBy: { piNo: 'asc' },
  })

  // 所有 SLS_Item（按 piId + rawSku 加總），跨所有出貨單
  const allSlsItems = await prisma.sLS_Item.groupBy({
    by: ['piId', 'rawSku'],
    _sum: { quantity: true },
    where: { piId: { not: null }, rawSku: { not: null } },
  })

  // piId → { sku → totalShipped }
  const shippedMap = new Map<number, Map<string, number>>()
  for (const row of allSlsItems) {
    if (!row.piId || !row.rawSku) continue
    const m = shippedMap.get(row.piId) ?? new Map<string, number>()
    m.set(row.rawSku, row._sum.quantity ?? 0)
    shippedMap.set(row.piId, m)
  }

  const rows = pis.map(pi => {
    const shipped = shippedMap.get(pi.id) ?? new Map<string, number>()
    const shipments = pi.shipmentPIs.map(l => l.shipment)

    // 品項勾稽
    const items = pi.items.map(item => {
      const sku = item.product?.sku ?? ''
      const committed = item.quantity
      const done = shipped.get(sku) ?? 0
      const remaining = committed - done
      const unitPrice = Number(item.unitPrice ?? 0)
      return {
        sku,
        name: item.product?.name ?? '',
        committed,
        shipped: done,
        remaining,
        committedEUR: +(committed * unitPrice).toFixed(2),
        shippedEUR: +(done * unitPrice).toFixed(2),
        remainingEUR: +(remaining * unitPrice).toFixed(2),
        status: remaining <= 0 ? 'done' : done > 0 ? 'partial' : 'pending',
      }
    })

    const totalCommittedEUR = items.reduce((s, i) => s + i.committedEUR, 0)
    const totalShippedEUR = items.reduce((s, i) => s + i.shippedEUR, 0)
    const totalRemainingEUR = items.reduce((s, i) => s + i.remainingEUR, 0)
    const allDone = items.length > 0 && items.every(i => i.status === 'done')
    const anyShipped = items.some(i => i.shipped > 0)
    const piStatus = allDone ? 'done' : anyShipped ? 'partial' : 'pending'

    return {
      piId: pi.id,
      piNo: pi.piNo,
      customer: pi.customer?.shortName ?? pi.customer?.name ?? '—',
      piStatus,
      shipments: shipments.map(s => ({
        shipmentNo: s.shipmentNo,
        actualShipDate: s.actualShipDate,
        ciExchangeRate: s.ciExchangeRate?.toString() ?? null,
      })),
      items,
      summary: {
        totalCommittedEUR: +totalCommittedEUR.toFixed(2),
        totalShippedEUR: +totalShippedEUR.toFixed(2),
        totalRemainingEUR: +totalRemainingEUR.toFixed(2),
      },
    }
  })

  // 只回傳有出貨記錄或有品項的 PI（過濾掉完全空的）
  return NextResponse.json(rows.filter(r => r.items.length > 0 || r.shipments.length > 0))
}
