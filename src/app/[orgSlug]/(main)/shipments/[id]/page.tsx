export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPagePrisma } from '@/lib/page-db'
import { orgPath } from '@/lib/org-path'
import { formatDate } from '@/lib/utils'
import ShipmentItemTable, { type ShipmentGroupData } from './ShipmentItemTable'

type Props = { params: { orgSlug: string; id: string } }

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 text-sm w-32 shrink-0">{label}</span>
      <span className="text-gray-800 text-sm">{value ?? '-'}</span>
    </div>
  )
}

export default async function ShipmentDetailPage({ params }: Props) {
  const prisma = await getPagePrisma(params.orgSlug)
  const id = parseInt(params.id, 10)
  if (isNaN(id)) notFound()

  const shipment = await prisma.sLS_Shipment.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, shortName: true } },
      pis: {
        include: {
          pi: {
            select: {
              id: true, piNo: true, etd: true,
              order: { select: { id: true, orderNo: true } },
            },
          },
        },
      },
      items: {
        include: {
          slsItem: {
            select: {
              unit: true,
              product: { select: { sku: true, name: true } },
            },
          },
          pi: { select: { id: true, piNo: true, orderId: true, totalAmount: true, currencyCode: true } },
        },
        orderBy: [{ piId: 'asc' }, { id: 'asc' }],
      },
    },
  })

  if (!shipment) notFound()

  const SOURCE_LABELS: Record<string, string> = {
    PATISCO: 'Patisco', MANUAL: '手動', AI_IMPORT: 'AI 匯入', UPS: 'UPS',
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={orgPath(params.orgSlug, '/shipments')} className="text-gray-400 hover:text-gray-600 text-sm">← 出貨單列表</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-800 font-mono">{shipment.shipmentNo}</h1>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">出貨資訊</h2>
          <Row label="出貨單號" value={<span className="font-mono">{shipment.shipmentNo}</span>} />
          <Row label="客戶" value={
            shipment.customer
              ? <Link href={orgPath(params.orgSlug, `/customers/${shipment.customer.id}`)} className="text-teal-600 hover:underline">
                  {shipment.customer.name}
                </Link>
              : '-'
          } />
          <Row label="出貨日期" value={formatDate(shipment.actualShipDate)} />
          <Row label="運送方式" value={shipment.shippingMethod} />
          <Row label="裝貨港" value={shipment.portOfLoading} />
          <Row label="卸貨港" value={shipment.portOfDischarge} />
          <Row label="追蹤號" value={shipment.trackingNo} />
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">文件資訊</h2>
          <Row label="商業發票號" value={shipment.commercialInvNo} />
          <Row label="裝箱單號" value={shipment.packingListNo} />
          <Row label="幣別" value={shipment.currencyCode} />
          {shipment.ciExchangeRate && (
            <Row label="CI 匯率" value={shipment.ciExchangeRate.toString()} />
          )}
          <Row label="來源" value={SOURCE_LABELS[shipment.source] ?? shipment.source} />
          {shipment.patiscoDocNo && (
            <Row label="Patisco 單號" value={<span className="font-mono text-xs">{shipment.patiscoDocNo}</span>} />
          )}
          <Row label="匯入日期" value={formatDate(shipment.performedAt)} />
          {shipment.note && <Row label="備註" value={shipment.note} />}
        </div>
      </div>

      {(() => {
        // 優先用 SLS_ShipmentPI junction table；若空（舊資料或 UPS 流程漏建），
        // 從 items.pi 推導唯一 PI 清單作為 fallback
        type PiEntry = { piId: number; piNo: string; orderId?: number | null; orderNo?: string | null; etd?: Date | null }
        let piList: PiEntry[] = shipment.pis.map(sp => ({
          piId: sp.piId,
          piNo: sp.pi.piNo,
          orderId: sp.pi.order?.id,
          orderNo: sp.pi.order?.orderNo,
          etd: sp.pi.etd,
        }))
        if (piList.length === 0) {
          const seen = new Set<number>()
          for (const item of shipment.items) {
            if (item.pi && !seen.has(item.pi.id)) {
              seen.add(item.pi.id)
              piList.push({ piId: item.pi.id, piNo: item.pi.piNo, orderId: item.pi.orderId })
            }
          }
        }
        if (piList.length === 0) return null
        return (
          <div className="bg-white rounded-lg shadow p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">關聯 PI</h2>
            <div className="flex flex-wrap gap-2">
              {piList.map(pi => (
                <div key={pi.piId} className="border border-gray-200 rounded px-3 py-2 text-sm">
                  <Link href={orgPath(params.orgSlug, `/sales/${pi.orderId ?? ''}`)} className="font-mono text-teal-600 hover:underline">
                    {pi.piNo}
                  </Link>
                  {pi.orderNo && (
                    <span className="text-gray-400 text-xs ml-2">(訂單 {pi.orderNo})</span>
                  )}
                  {pi.etd && (
                    <span className="text-gray-400 text-xs ml-2">ETD: {formatDate(pi.etd)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {shipment.items.length > 0 && (() => {
        // 序列化 Decimal → string，以 PI 分組，傳給 Client Component
        type Item = typeof shipment.items[number]
        const groupMap = new Map<string, ShipmentGroupData>()
        for (const item of shipment.items) {
          const key = item.piId != null ? String(item.piId) : '__none__'
          if (!groupMap.has(key)) {
            groupMap.set(key, {
              label: item.pi?.piNo ?? '未關聯 PI',
              piId: item.piId,
              piTotalAmount: item.pi?.totalAmount?.toString() ?? null,
              piCurrencyCode: item.pi?.currencyCode ?? null,
              items: [],
            })
          }
          const g = groupMap.get(key)!
          g.items.push({
            id: item.id,
            sku: item.slsItem?.product?.sku ?? item.rawSku ?? null,
            productName: item.slsItem?.product?.name ?? item.rawProductName ?? null,
            quantity: item.quantity,
            unit: (item as unknown as { unit?: string | null }).unit ?? item.slsItem?.unit ?? null,
            unitPrice: (item as unknown as { unitPrice?: { toString(): string } | null }).unitPrice?.toString() ?? null,
            grossWeightKg: item.grossWeightKg?.toString() ?? null,
            netWeightKg: item.netWeightKg?.toString() ?? null,
            cubicFt: item.cubicFt?.toString() ?? null,
            cbm: item.cbm?.toString() ?? null,
            cartons: item.cartons ?? null,
            cartonNoFrom: item.cartonNoFrom ?? null,
            cartonNoTo: item.cartonNoTo ?? null,
            hasSlsItem: !!item.slsItem,
            hasRawSku: !!item.rawSku,
          })
        }
        const groups = Array.from(groupMap.values())

        return (
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">裝箱明細</h2>
            </div>
            <ShipmentItemTable groups={groups} shipmentCurrencyCode={shipment.currencyCode} />
          </div>
        )
      })()}

      {shipment.items.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
          尚無裝箱明細。若此出貨單來自 Patisco，請重新執行同步以拉取 Packing List 資料。
        </div>
      )}
    </div>
  )
}
