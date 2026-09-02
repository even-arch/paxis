/**
 * GET /api/finance/shipment-payables
 * 回傳「有未付應付帳款」的出貨單列表，每筆出貨附帶：
 *   - 相關供應商的應付帳款
 *   - 該出貨的 SLS_FobCostItem（貨代費用分攤基準）
 * 只回傳 shipmentId 不為 null、尚未被加入付款通知單、status 0/1 的帳款。
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function GET() {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payables = await prisma.fIN_Payable.findMany({
    where: {
      shipmentId: { not: null },
      status: { in: [0, 1] },
      voucherItem: null,
    },
    select: {
      id: true,
      supplierId: true,
      poId: true,
      amountTWD: true,
      fobCostDeductionTWD: true,
      dueDate: true,
      status: true,
      shipmentId: true,
      supplier: { select: { id: true, name: true, shortName: true, defaultTradeTerms: true, commissionPct: true } },
      po: { select: { id: true, poNo: true, tradeTerms: true } },
      shipment: {
        select: {
          id: true, shipmentNo: true, actualShipDate: true,
          customer: { select: { name: true, shortName: true } },
        },
      },
    },
  })

  if (payables.length === 0) return NextResponse.json({ shipments: [] })

  const shipmentIds = Array.from(new Set(payables.map(p => p.shipmentId as number)))

  const fobCostItems = await prisma.sLS_FobCostItem.findMany({
    where: { shipmentId: { in: shipmentIds } },
    select: { id: true, shipmentId: true, name: true, amountTWD: true, note: true },
    orderBy: { createdAt: 'asc' },
  })

  // Group by shipment
  const shipmentMap = new Map<number, {
    id: number; shipmentNo: string; actualShipDate: unknown; customerName: string | null
    fobCostItems: { id: number; name: string; amountTWD: number; note: string | null }[]
    payables: {
      id: number; supplierId: number; supplierName: string; supplierFullName: string
      defaultTradeTerms: string | null; commissionPct: number; poNo: string | null; poId: number | null
      amountTWD: number; fobCostDeductionTWD: number | null; dueDate: unknown
      status: number; tradeTerms: string | null
    }[]
  }>()

  for (const p of payables) {
    if (!p.shipmentId || !p.shipment) continue
    if (!shipmentMap.has(p.shipmentId)) {
      shipmentMap.set(p.shipmentId, {
        id: p.shipment.id,
        shipmentNo: p.shipment.shipmentNo,
        actualShipDate: p.shipment.actualShipDate,
        customerName: p.shipment.customer?.shortName ?? p.shipment.customer?.name ?? null,
        fobCostItems: fobCostItems
          .filter(f => f.shipmentId === p.shipmentId)
          .map(f => ({ id: f.id, name: f.name, amountTWD: Number(f.amountTWD), note: f.note })),
        payables: [],
      })
    }
    shipmentMap.get(p.shipmentId)!.payables.push({
      id: p.id,
      supplierId: p.supplierId,
      supplierName: p.supplier.shortName ?? p.supplier.name,
      supplierFullName: p.supplier.name,
      defaultTradeTerms: p.supplier.defaultTradeTerms,
      commissionPct: Number(p.supplier.commissionPct ?? 0),
      poNo: p.po?.poNo ?? null,
      poId: p.poId,
      amountTWD: Number(p.amountTWD),
      fobCostDeductionTWD: p.fobCostDeductionTWD ? Number(p.fobCostDeductionTWD) : null,
      dueDate: p.dueDate,
      status: p.status,
      tradeTerms: p.po?.tradeTerms ?? p.supplier.defaultTradeTerms ?? null,
    })
  }

  const shipments = Array.from(shipmentMap.values()).sort((a, b) => {
    if (!a.actualShipDate) return 1
    if (!b.actualShipDate) return -1
    return new Date(b.actualShipDate as string).getTime() - new Date(a.actualShipDate as string).getTime()
  })

  return NextResponse.json({ shipments })
}
