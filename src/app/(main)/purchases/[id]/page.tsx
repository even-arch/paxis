import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatDate, formatCurrency } from '@/lib/utils'
import { statusBadge } from '@/modules/purchase/poUtils'
import PurchaseActions from './PurchaseActions'
import LinkSalesOrderButton from './LinkSalesOrderButton'

type Props = { params: { id: string } }

export default async function PurchaseDetailPage({
  params }: Props) {
    const order = await prisma.pO_Order.findUnique({
    where: { id: Number(params.id) },
    include: {
      supplier: true,
      creator: { select: { name: true } },
      items: {
        include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
      },
      receipts: {
        include: {
          items: {
            include: {
              poItem: {
                include: { product: { select: { id: true, name: true, sku: true } } },
              },
            },
          },
        },
        orderBy: { performedAt: 'desc' },
      },
      supplierPIs: {
        include: {
          items: { include: { poItem: { include: { product: { select: { name: true, sku: true } } } } } },
          performer: { select: { name: true } },
        },
        orderBy: { performedAt: 'desc' },
      },
    },
  })

  if (!order) notFound()

  // 關聯客戶訂單：優先用 salesOrderId FK，fallback 用單號比對
  const [linkedSalesOrder, openSalesOrders] = await Promise.all([
    order.salesOrderId
      ? prisma.sLS_Order.findUnique({
          where: { id: order.salesOrderId },
          select: { id: true, orderNo: true, status: true, customer: { select: { name: true } }, patiscoBuyerName: true },
        })
      : prisma.sLS_Order.findFirst({
          where: {
            OR: [
              { orderNo: order.poNo },
              { orderNo: order.poNo.replace(/-\d+$/, '') }, // 去掉後綴（ABC-001-1 → ABC-001）
            ],
          },
          select: { id: true, orderNo: true, status: true, customer: { select: { name: true } }, patiscoBuyerName: true },
        }),
    // 供「連結客戶訂單」選單用
    prisma.sLS_Order.findMany({
      where: { status: { in: [0, 1, 2, 3] } },
      select: { id: true, orderNo: true, customer: { select: { name: true } }, patiscoBuyerName: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ])

  const badge = statusBadge(order.status)
  const isDraft = order.status === 0
  const canReceive = order.status === 1 || order.status === 2

  const totalAmount = order.items.reduce((sum, item) => {
    return sum + (parseFloat(item.unitPrice.toString()) * item.quantity)
  }, 0)

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/purchases" className="text-sm text-gray-400 hover:text-gray-600">← 採購訂單</Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold text-gray-800 font-mono">{order.poNo}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>{badge.label}</span>
          </div>
          {order.patiscoOrderNo && (
            <p className="text-sm text-gray-500 mt-0.5">
              對應 Patisco 訂單：<span className="font-mono">{order.patiscoOrderNo}</span>
            </p>
          )}
        </div>
        <PurchaseActions
          orderId={params.id}
          status={order.status}
          defaultCurrency={order.currencyCode}
          hasReceipts={order.receipts.length > 0}
          items={order.items.map(i => ({
            id: i.id,
            productName: i.product.name,
            productSku: i.product.sku ?? null,
            quantity: i.quantity,
            receivedQty: i.receivedQty,
            unit: i.unit ?? i.product.unit ?? 'PCS',
            unitPrice: i.unitPrice.toString(),
            currencyCode: order.currencyCode,
          }))}
          supplierPIs={order.supplierPIs.map(pi => ({
            id: pi.id,
            piNo: pi.piNo,
            estimatedShipDate: pi.estimatedShipDate?.toISOString() ?? null,
            performedAt: pi.performedAt.toISOString(),
            performerName: pi.performer?.name ?? null,
            items: pi.items.map(i => ({
              poItemId: i.poItemId,
              confirmedQty: i.confirmedQty,
              productName: i.poItem.product.name,
            })),
          }))}
        />
      </div>

      <div className="space-y-4">
        {/* 採購資訊 */}
        <div className="bg-white rounded-lg shadow p-6 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 text-sm">
          <Row label="供應商" value={order.supplier.name} />
          <Row label="採購觸發" value={['主動補貨', '接單採購', '安全庫存'][order.sourceType] ?? '-'} />
          <Row label="幣別" value={order.currencyCode} />
          <Row label="匯率" value={order.exchangeRate.toString()} />
          <Row label="預計到貨" value={order.expectedDate ? formatDate(order.expectedDate) : undefined} />
          <Row label="裝運港" value={order.port} />
          <Row label="運送方式" value={order.shipVia} />
          <Row label="實際到貨" value={order.arrivedDate ? formatDate(order.arrivedDate) : undefined} />
          <Row label="建立者" value={order.creator.name} />
          <Row label="建立日期" value={formatDate(order.createdAt)} />
          {order.note && <div className="col-span-3"><Row label="備註" value={order.note} /></div>}
        </div>

        {/* 來源客戶訂單 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">來源客戶訂單</p>
            <LinkSalesOrderButton
              poId={order.id}
              currentSalesOrderId={linkedSalesOrder?.id ?? null}
              salesOrders={openSalesOrders.map(s => ({
                id: s.id,
                orderNo: s.orderNo,
                customerName: s.customer?.name ?? s.patiscoBuyerName ?? null,
              }))}
            />
          </div>
          {linkedSalesOrder ? (
            <Link href={`/sales/${linkedSalesOrder.id}`}
              className="inline-flex items-center gap-3 bg-white border border-blue-200 rounded-lg px-4 py-2.5 mt-2 hover:border-blue-400 transition-colors">
              <span className="font-mono font-medium text-blue-700 text-sm">{linkedSalesOrder.orderNo}</span>
              {(linkedSalesOrder.customer?.name || linkedSalesOrder.patiscoBuyerName) && (
                <span className="text-gray-500 text-sm">
                  {linkedSalesOrder.customer?.name ?? linkedSalesOrder.patiscoBuyerName}
                </span>
              )}
              <span className="text-xs text-gray-400">→ 查看交易鏈</span>
            </Link>
          ) : (
            <p className="text-sm text-gray-400 mt-1">尚未連結客戶訂單。點右上角「+ 連結客戶訂單」補上連結。</p>
          )}
        </div>

        {/* 採購明細 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-700">採購明細（正本）</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">商品</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">數量</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">單位</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">單價</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">小計</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">已入庫</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">進度</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {order.items.map(item => {
                const lineTotal = parseFloat(item.unitPrice.toString()) * item.quantity
                const pct = item.quantity > 0 ? Math.min(100, Math.round((item.receivedQty / item.quantity) * 100)) : 0
                const done = item.receivedQty >= item.quantity
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <Link href={`/products/${item.product.id}`} className="text-blue-600 hover:underline">
                        {item.product.name}
                      </Link>
                      {item.product.sku && <span className="text-gray-400 text-xs ml-1">({item.product.sku})</span>}
                    </td>
                    <td className="px-4 py-3 text-right">{item.quantity.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500">{item.unit ?? item.product.unit ?? '-'}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(item.unitPrice.toString(), order.currencyCode)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(lineTotal, order.currencyCode)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={done ? 'text-green-600 font-medium' : 'text-gray-600'}>
                        {item.receivedQty.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${done ? 'bg-green-500' : 'bg-blue-400'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right font-medium text-gray-700">總金額</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  {formatCurrency(totalAmount, order.currencyCode)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 入庫紀錄 */}
        {order.receipts.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-700">入庫紀錄</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {order.receipts.map(receipt => {
                const receiptTotal = receipt.items.reduce((sum, ri) => {
                  const price = parseFloat(ri.poItem.unitPrice.toString())
                  return sum + price * ri.quantity
                }, 0)
                return (
                  <div key={receipt.id} className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-medium text-gray-800">{receipt.receiptNo}</span>
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">已入庫</span>
                      </div>
                      <span className="text-sm text-gray-500">
                        入庫日期：<span className="text-gray-700 font-medium">{formatDate(receipt.performedAt)}</span>
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                          <th className="pb-1.5 font-normal">商品</th>
                          <th className="pb-1.5 font-normal text-right">入庫數量</th>
                          <th className="pb-1.5 font-normal text-right">供應商訂單價</th>
                          <th className="pb-1.5 font-normal text-right">實際成本</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receipt.items.map(ri => {
                          const lineTotal = parseFloat(ri.poItem.unitPrice.toString()) * ri.quantity
                          return (
                            <tr key={ri.id} className="border-b border-gray-50 last:border-0">
                              <td className="py-2">
                                <Link href={`/products/${ri.poItem.product.id}`} className="text-blue-600 hover:underline">
                                  {ri.poItem.product.name}
                                </Link>
                                {ri.poItem.product.sku && (
                                  <span className="text-gray-400 text-xs ml-1">({ri.poItem.product.sku})</span>
                                )}
                              </td>
                              <td className="py-2 text-right">{ri.quantity.toLocaleString()}</td>
                              <td className="py-2 text-right text-gray-500">
                                {formatCurrency(ri.poItem.unitPrice.toString(), order.currencyCode)}
                              </td>
                              <td className="py-2 text-right font-medium">
                                {formatCurrency(lineTotal, order.currencyCode)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3} className="pt-2 text-right text-xs text-gray-500">本次入庫成本合計</td>
                          <td className="pt-2 text-right font-bold text-gray-800">
                            {formatCurrency(receiptTotal, order.currencyCode)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                    {receipt.note && <p className="text-xs text-gray-400 mt-2">{receipt.note}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {isDraft && (
          <p className="text-xs text-gray-400 text-center">草稿狀態，請點「送出供應商訂單」後即可對工廠發出正式訂單</p>
        )}
        {canReceive && (
          <p className="text-xs text-gray-400 text-center">供應商訂單已送出，收到貨物後點「確認入庫」更新庫存</p>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 shrink-0 w-20">{label}</span>
      <span className="text-gray-800">{value || '-'}</span>
    </div>
  )
}

