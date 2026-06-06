import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

type Params = { params: { id: string; shipmentId: string } }

export async function GET(_req: NextRequest, {
  params }: Params) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = Number(params.shipmentId)

  const shipment = await prisma.sLS_Shipment.findUnique({
    where: { id: shipmentId },
    include: {
      order: { select: { currencyCode: true, exchangeRate: true } },
      items: {
        include: {
          slsItem: {
            include: {
              product: {
                include: {
                  supplierProducts: {
                    where: { isPreferred: true },
                    include: { supplier: { select: { id: true, name: true, shortName: true } } },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!shipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 計算各供應商的出貨金額
  const supplierMap = new Map<number | null, {
    supplierId: number | null
    supplierName: string
    items: { productName: string; sku: string | null; qty: number; unitPrice: number; value: number }[]
    totalValue: number
  }>()

  const unassignedKey = null

  for (const shipItem of shipment.items) {
    const slsItem = shipItem.slsItem
    const product = slsItem.product
    const unitPrice = Number(slsItem.unitPrice)
    const qty = shipItem.quantity
    const value = qty * unitPrice

    const preferred = product.supplierProducts[0]
    const supplierId = preferred?.supplier.id ?? unassignedKey
    const supplierName = preferred?.supplier.shortName ?? preferred?.supplier.name ?? '（未指定供應商）'

    if (!supplierMap.has(supplierId)) {
      supplierMap.set(supplierId, { supplierId, supplierName, items: [], totalValue: 0 })
    }
    const entry = supplierMap.get(supplierId)!
    entry.items.push({ productName: product.name, sku: product.sku, qty, unitPrice, value })
    entry.totalValue += value
  }

  const breakdown = Array.from(supplierMap.values()).sort((a, b) => b.totalValue - a.totalValue)
  const totalValue = breakdown.reduce((s, b) => s + b.totalValue, 0)

  return NextResponse.json({
    shipmentNo: shipment.shipmentNo,
    actualShipDate: shipment.actualShipDate,
    currencyCode: shipment.order.currencyCode,
    totalValue,
    breakdown: breakdown.map(b => ({
      supplierId: b.supplierId,
      supplierName: b.supplierName,
      totalValue: b.totalValue,
      pct: totalValue > 0 ? (b.totalValue / totalValue) * 100 : 0,
      items: b.items,
    })),
  })
}
