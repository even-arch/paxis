export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'

type Props = { params: { id: string } }

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 text-sm w-32 shrink-0">{label}</span>
      <span className="text-gray-800 text-sm">{value ?? '-'}</span>
    </div>
  )
}

export default async function ShipmentDetailPage({ params }: Props) {
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
            include: {
              product: { select: { sku: true, name: true } },
            },
          },
        },
        orderBy: { id: 'asc' },
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
        <Link href="/shipments" className="text-gray-400 hover:text-gray-600 text-sm">← 出貨單列表</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-800 font-mono">{shipment.shipmentNo}</h1>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">出貨資訊</h2>
          <Row label="出貨單號" value={<span className="font-mono">{shipment.shipmentNo}</span>} />
          <Row label="客戶" value={
            shipment.customer
              ? <Link href={`/customers/${shipment.customer.id}`} className="text-teal-600 hover:underline">
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

      {shipment.pis.length > 0 && (
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">關聯 PI</h2>
          <div className="flex flex-wrap gap-2">
            {shipment.pis.map(sp => (
              <div key={sp.piId} className="border border-gray-200 rounded px-3 py-2 text-sm">
                <Link href={`/sales/${sp.pi.order?.id}`} className="font-mono text-teal-600 hover:underline">
                  {sp.pi.piNo}
                </Link>
                {sp.pi.order && (
                  <span className="text-gray-400 text-xs ml-2">(訂單 {sp.pi.order.orderNo})</span>
                )}
                {sp.pi.etd && (
                  <span className="text-gray-400 text-xs ml-2">ETD: {formatDate(sp.pi.etd)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {shipment.items.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">裝箱明細</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">SKU</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">品名</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">數量</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">箱數</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">毛重 (kg)</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">淨重 (kg)</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">材積 (m³)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shipment.items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">{item.slsItem?.product?.sku ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-700">{item.slsItem?.product?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{item.quantity.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{item.cartons ?? '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{item.grossWeightKg?.toString() ?? '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{item.netWeightKg?.toString() ?? '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{item.cbm?.toString() ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {shipment.items.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
          尚無裝箱明細。若此出貨單來自 Patisco，請重新執行同步以拉取 Packing List 資料。
        </div>
      )}
    </div>
  )
}
