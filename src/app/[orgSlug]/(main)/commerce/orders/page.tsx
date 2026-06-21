export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getPagePrisma } from '@/lib/page-db'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  PLATFORM_LABELS,
  FULFILLMENT_LABELS,
  assessCommerceOrder,
  buildMockMarketplaceOrders,
  type CommerceProductSnapshot,
} from '@/modules/commerce/mockMarketplace'
import { buildOmsAssist, type OmsAssistPriority } from '@/modules/commerce/omsAssist'
import CommerceImportButton from './CommerceImportButton'

const STATUS_META = {
  paid: { label: '已付款', color: 'bg-blue-100 text-blue-700' },
  ready_to_ship: { label: '待出貨', color: 'bg-purple-100 text-purple-700' },
  overdue_risk: { label: '接近時限', color: 'bg-red-100 text-red-700' },
}

const PLATFORM_BADGES = {
  shopee: 'bg-orange-100 text-orange-700',
  ruten: 'bg-sky-100 text-sky-700',
  momo: 'bg-pink-100 text-pink-700',
}

const ASSIST_PRIORITY_META: Record<OmsAssistPriority, { label: string; color: string }> = {
  high: { label: '高', color: 'bg-red-100 text-red-700' },
  medium: { label: '中', color: 'bg-blue-100 text-blue-700' },
  low: { label: '低', color: 'bg-gray-100 text-gray-600' },
}

function deliveryLabel(type: 'home' | '711' | 'family') {
  if (type === '711') return '7-11 超取'
  if (type === 'family') return '全家超取'
  return '宅配'
}

export default async function CommerceOrdersPage({ params }: { params: { orgSlug: string } }) {
  const prisma = await getPagePrisma(params.orgSlug)
  const products = await prisma.pRD_Product.findMany({
    where: { isActive: true },
    orderBy: [{ isAvailableForPos: 'desc' }, { createdAt: 'desc' }],
    take: 12,
    select: {
      id: true,
      name: true,
      sku: true,
      unit: true,
      sellingPrice: true,
      inventoryItems: { select: { quantity: true, reservedQty: true } },
    },
  })

  const snapshots: CommerceProductSnapshot[] = products.map(product => {
    const stock = product.inventoryItems[0]
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      sellingPrice: product.sellingPrice?.toString() ?? null,
      quantity: stock?.quantity ?? 0,
      reservedQty: stock?.reservedQty ?? 0,
    }
  })

  const orders = buildMockMarketplaceOrders(snapshots)
  const imported = orders.length
    ? await prisma.pO_CustomerCopy.findMany({
        where: { orderNo: { in: orders.map(order => order.platformOrderNo) } },
        select: { id: true, orderNo: true },
      })
    : []
  const importedMap = new Map(imported.map(order => [order.orderNo, order.id]))

  const readyCount = orders.filter(order => assessCommerceOrder(order).canImport).length
  const riskCount = orders.filter(order => order.status === 'overdue_risk').length
  const orderTotal = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0)
  const assist = buildOmsAssist(orders)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">電商訂單</h1>
          <p className="mt-1 text-sm text-gray-500">Marketplace OMS</p>
        </div>
        <Link
          href="/sales"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          客戶訂單
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg bg-white p-5 shadow">
          <p className="mb-1 text-xs text-gray-500">平台訂單</p>
          <p className="text-2xl font-semibold text-gray-800">{orders.length}</p>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <p className="mb-1 text-xs text-gray-500">可匯入</p>
          <p className="text-2xl font-semibold text-blue-600">{readyCount}</p>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <p className="mb-1 text-xs text-gray-500">時限警示</p>
          <p className={`text-2xl font-semibold ${riskCount ? 'text-red-600' : 'text-green-600'}`}>{riskCount}</p>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <p className="mb-1 text-xs text-gray-500">訂單金額</p>
          <p className="text-2xl font-semibold text-gray-800">{formatCurrency(orderTotal, 'TWD')}</p>
        </div>
      </div>

      {orders.length > 0 && (
        <div className="mb-6 grid grid-cols-[1.2fr_0.8fr] gap-4">
          <section className="rounded-lg bg-white p-5 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">AI Assist</h2>
                <p className="mt-1 text-xs text-gray-400">OMS 履行建議</p>
              </div>
              <span className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">Rule mode</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs text-gray-500">可預留</p>
                <p className="mt-1 text-xl font-semibold text-blue-600">{assist.readyToImport}</p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs text-gray-500">需調貨</p>
                <p className="mt-1 text-xl font-semibold text-amber-600">{assist.needsPurchase}</p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs text-gray-500">時限風險</p>
                <p className={`mt-1 text-xl font-semibold ${assist.deadlineRisk ? 'text-red-600' : 'text-green-600'}`}>
                  {assist.deadlineRisk}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {assist.recommendations.map(rec => {
                const priority = ASSIST_PRIORITY_META[rec.priority]
                return (
                  <div key={rec.id} className="flex items-start gap-3 rounded-md border border-gray-200 p-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${priority.color}`}>
                      {priority.label}
                    </span>
                    <div>
                      <p className="font-medium text-gray-800">{rec.title}</p>
                      <p className="mt-1 text-xs text-gray-500">{rec.detail}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-lg bg-white p-5 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">物流分組</h2>
              <span className="text-xs text-gray-400">{assist.carrierBatches.length} 組</span>
            </div>
            <div className="space-y-3">
              {assist.carrierBatches.map(batch => (
                <div key={batch.carrier} className="rounded-md border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-800">{batch.carrier}</p>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{batch.count} 筆</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-400">{batch.orderNos.join('、')}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center text-sm text-gray-400 shadow">
          目前沒有可比對的 Paxis 商品
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">平台訂單</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">消費者 / 配送</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">品項</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">金額</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">履行</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">狀態</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">動作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map(order => {
                const assessment = assessCommerceOrder(order)
                const importedOrderId = importedMap.get(order.platformOrderNo)
                const status = STATUS_META[order.status]

                return (
                  <tr key={order.id} className="align-top hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${PLATFORM_BADGES[order.platform]}`}>
                          {PLATFORM_LABELS[order.platform]}
                        </span>
                        <span className="text-xs text-gray-400">{order.accountName}</span>
                      </div>
                      <p className="mt-2 font-mono text-xs font-medium text-gray-800">{order.platformOrderNo}</p>
                      <p className="mt-1 text-xs text-gray-400">下單 {formatDate(order.orderedAt)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-800">{order.consumer.name}</p>
                      <p className="mt-1 text-xs text-gray-500">{order.consumer.phone}</p>
                      <p className="mt-2 text-xs text-gray-500">
                        {deliveryLabel(order.shippingAddress.deliveryType)} · {order.carrierPreference}
                      </p>
                      <p className="mt-1 max-w-52 text-xs text-gray-400">
                        {order.shippingAddress.city}{order.shippingAddress.district}{order.shippingAddress.address}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        {order.items.map(item => {
                          const shortage = item.availableQty < item.quantity
                          return (
                            <div key={item.platformItemId}>
                              <p className="font-medium text-gray-800">{item.name}</p>
                              <p className="mt-0.5 text-xs text-gray-500">
                                <span className="font-mono">{item.sku}</span>
                                <span className="mx-1">×</span>
                                {item.quantity.toLocaleString()} {item.unit ?? ''}
                              </p>
                              <p className={`mt-0.5 text-xs ${shortage ? 'text-red-600' : 'text-blue-600'}`}>
                                可用 {item.availableQty.toLocaleString()} {item.unit ?? ''}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="font-semibold text-gray-800">{formatCurrency(order.totalAmount, 'TWD')}</p>
                      <p className="mt-1 text-xs text-gray-400">運費 {formatCurrency(order.shippingFee, 'TWD')}</p>
                      <p className="mt-1 text-xs text-gray-400">平台費 {formatCurrency(order.platformFee, 'TWD')}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-800">{FULFILLMENT_LABELS[order.fulfillmentMode]}</p>
                      <p className="mt-1 text-xs text-gray-400">出貨期限 {formatDate(order.shipBy)}</p>
                      {assessment.insufficientItems.length > 0 && (
                        <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                          {assessment.insufficientItems.length} 項庫存不足
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                      {importedOrderId && (
                        <p className="mt-2 text-xs font-medium text-green-600">已進 Paxis</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <CommerceImportButton
                        orderId={order.id}
                        canImport={assessment.canImport}
                        importedOrderId={importedOrderId}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
