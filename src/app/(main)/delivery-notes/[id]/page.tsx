export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = { DRAFT: '草稿', DISPATCHED: '已出貨', RECEIVED: '已簽收' }
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  DISPATCHED: 'bg-blue-50 text-blue-700',
  RECEIVED: 'bg-green-50 text-green-700',
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-gray-400 text-xs w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-gray-800 text-sm">{value ?? '-'}</span>
    </div>
  )
}

export default async function DeliveryNoteDetailPage({ params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  if (isNaN(id)) notFound()

  const dn = await prisma.sLS_DeliveryNote.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, shortName: true } },
      slsPi:    { select: { id: true, piNo: true } },
      slsOrder: { select: { id: true, orderNo: true } },
      items: {
        include: { product: { select: { sku: true, name: true } } },
        orderBy: { id: 'asc' },
      },
    },
  })
  if (!dn) notFound()

  const totalQty     = dn.items.reduce((s, i) => s + i.quantity, 0)
  const totalCartons = dn.items.reduce((s, i) => s + (i.cartons ?? 0), 0)
  const totalWeight  = dn.items.reduce((s, i) => s + Number(i.grossWeightKg ?? 0), 0)

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/delivery-notes" className="text-gray-400 hover:text-gray-600 text-sm">← 出貨單列表</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-800 font-mono">{dn.docNo}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[dn.status] ?? 'bg-gray-100 text-gray-500'}`}>
          {STATUS_LABEL[dn.status] ?? dn.status}
        </span>
        <Link href={`/api/delivery-notes/${id}/print`} target="_blank"
          className="ml-auto text-sm border border-gray-300 hover:border-gray-400 text-gray-600 px-3 py-1.5 rounded-lg">
          列印三聯單
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">出貨資訊</h2>
          <Row label="客戶" value={
            dn.customer
              ? <Link href={`/customers/${dn.customer.id}`} className="text-teal-600 hover:underline">{dn.customer.name}</Link>
              : null
          } />
          <Row label="關聯 PI" value={
            dn.slsPi ? <span className="font-mono text-xs">{dn.slsPi.piNo}</span> : null
          } />
          <Row label="關聯訂單" value={
            dn.slsOrder
              ? <Link href={`/sales/${dn.slsOrder.id}`} className="font-mono text-xs text-blue-600 hover:underline">{dn.slsOrder.orderNo}</Link>
              : null
          } />
          <Row label="出貨日期" value={formatDate(dn.issueDate)} />
          <Row label="預計送達" value={formatDate(dn.deliveryDate)} />
          <Row label="對方單號" value={dn.counterpartNo} />
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">聯絡與物流</h2>
          <Row label="聯絡人" value={dn.contactName} />
          <Row label="電話" value={dn.contactPhone} />
          <Row label="送貨地址" value={dn.deliveryAddr} />
          <Row label="貨運行" value={dn.freightCo} />
          <Row label="車號" value={dn.vehicleNo} />
        </div>
      </div>

      {(dn.shippingMark || dn.note) && (
        <div className="bg-white rounded-lg shadow p-5 mb-5">
          <h2 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">麥頭／備註</h2>
          {dn.shippingMark && <pre className="text-sm font-mono text-gray-700 whitespace-pre-wrap mb-2">{dn.shippingMark}</pre>}
          {dn.note && <p className="text-sm text-gray-600">{dn.note}</p>}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden mb-5">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">品項明細</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">序</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">SKU</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">品名描述</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">數量</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">單位</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">箱數</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">毛重(kg)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dn.items.map((item, i) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-400 text-xs">{String(i + 1).padStart(2, '0')}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">{item.product?.sku ?? '-'}</td>
                <td className="px-4 py-2 text-gray-700">{item.description ?? item.product?.name ?? '-'}</td>
                <td className="px-4 py-2 text-right text-gray-700">{item.quantity.toLocaleString()}</td>
                <td className="px-4 py-2 text-gray-500">{item.unit ?? '-'}</td>
                <td className="px-4 py-2 text-right text-gray-500">{item.cartons ?? '-'}</td>
                <td className="px-4 py-2 text-right text-gray-500">{item.grossWeightKg?.toString() ?? '-'}</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold text-sm">
              <td colSpan={3} className="px-4 py-2 text-right text-gray-500">合計</td>
              <td className="px-4 py-2 text-right text-gray-700">{totalQty.toLocaleString()}</td>
              <td></td>
              <td className="px-4 py-2 text-right text-gray-700">{totalCartons}</td>
              <td className="px-4 py-2 text-right text-gray-700">{totalWeight > 0 ? totalWeight.toFixed(1) : '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
