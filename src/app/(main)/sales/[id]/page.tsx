import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatDate, formatCurrency } from '@/lib/utils'
import SalesPIPanel from './SalesPIPanel'
import SalesShipmentPanel from './SalesShipmentPanel'
import SalesChainPanel from './SalesChainPanel'
import CustomerPoPanel from './CustomerPoPanel'

type Props = { params: { id: string } }

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: '草稿',    color: 'bg-gray-100 text-gray-600' },
  1: { label: '已確認',  color: 'bg-blue-100 text-blue-700' },
  2: { label: 'PI 已發', color: 'bg-purple-100 text-purple-700' },
  3: { label: '部分出貨', color: 'bg-amber-100 text-amber-700' },
  4: { label: '完成',    color: 'bg-green-100 text-green-700' },
  5: { label: '取消',    color: 'bg-red-100 text-red-600' },
}

const SOURCE_LABELS: Record<string, string> = {
  PATISCO: 'Patisco 自動', MANUAL: '手動建立', AI_IMPORT: 'AI 匯入',
}

export default async function SalesDetailPage({
  params }: Props) {
    const order = await prisma.sLS_Order.findUnique({
    where: { id: Number(params.id) },
    include: {
      customer: true,
      creator: { select: { name: true } },
      performer: { select: { name: true } },
      items: {
        include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
        orderBy: { id: 'asc' },
      },
      pis: {
        orderBy: { performedAt: 'desc' },
        include: { items: { include: { slsItem: true } } },
      },
      shipments: {
        orderBy: { performedAt: 'desc' },
        include: {
          performer: { select: { name: true } },
          items: {
            include: {
              slsItem: { include: { product: { select: { name: true, sku: true } } } },
            },
          },
        },
      },
    },
  })

  if (!order) notFound()

  // 關聯供應商訂單：優先用 salesOrderId FK，fallback 用單號前綴比對
  const linkedPurchaseOrders = await prisma.pO_Order.findMany({
    where: {
      OR: [
        { salesOrderId: order.id },
        { poNo: order.orderNo },                          // 完全相同
        { poNo: { startsWith: `${order.orderNo}-` } },   // 拆單後綴（ABC-001-1…）
      ],
    },
    include: {
      supplier: { select: { name: true } },
      items: {
        include: { product: { select: { id: true } } },
      },
      receipts: { select: { id: true } },
      supplierPIs: {
        select: { estimatedShipDate: true },
        orderBy: { performedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { poNo: 'asc' },
  })

  const badge = STATUS_LABELS[order.status] ?? STATUS_LABELS[0]
  const customerName = order.customer?.name ?? order.patiscoBuyerName ?? '（未關聯客戶）'
  const totalAmount = order.items.reduce((s, i) => s + parseFloat(i.unitPrice.toString()) * i.quantity, 0)

  // 組裝 SalesChainPanel 所需資料
  const chainSLSItems = order.items.map(i => ({
    productId:   i.product.id,
    productName: i.product.name,
    productSku:  i.product.sku,
    sellQty:     i.quantity,
    sellPrice:   parseFloat(i.unitPrice.toString()),
    sellCurrency: order.currencyCode,
  }))

  const chainLinkedPOs = linkedPurchaseOrders.map(po => ({
    id:          po.id,
    poNo:        po.poNo,
    status:      po.status,
    supplierName: po.supplier.name,
    createdAt:   po.createdAt,
    hasReceipt:  po.receipts.length > 0,
    estimatedShipDate: po.supplierPIs[0]?.estimatedShipDate ?? null,
    items: po.items.map(i => ({
      productId:   i.product.id,
      buyQty:      i.quantity,
      buyPrice:    parseFloat(i.unitPrice.toString()),
      buyCurrency: po.currencyCode,
    })),
  }))

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/sales" className="text-sm text-gray-400 hover:text-gray-600">← 客戶訂單</Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold text-gray-800 font-mono">{order.orderNo}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>{badge.label}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{customerName}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* 訂單資訊 */}
        <div className="bg-white rounded-lg shadow p-6 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 text-sm">
          <Row label="客戶" value={customerName} />
          <Row label="幣別" value={order.currencyCode} />
          <Row label="匯率" value={order.exchangeRate.toString()} />
          <Row label="來源" value={SOURCE_LABELS[order.source] ?? order.source} />
          <Row label="建立者" value={order.creator.name} />
          <Row label="操作者" value={order.performer?.name} />
          {order.customerRequestedShipDate && (
            <Row label="客戶希望出貨日" value={formatDate(order.customerRequestedShipDate)} />
          )}
          {order.patiscoDocNo && (
            <Row label="Patisco 文件號" value={order.patiscoDocNo} />
          )}
          <Row label="建立時間" value={formatDate(order.createdAt)} />
          {order.note && <div className="col-span-3"><Row label="備註" value={order.note} /></div>}
        </div>

        {/* 交易鏈視圖 */}
        <SalesChainPanel
          salesOrderId={order.id}
          salesOrderNo={order.orderNo}
          sellCurrency={order.currencyCode}
          slsItems={chainSLSItems}
          linkedPOs={chainLinkedPOs}
        />

        {/* 訂單明細 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-700">訂單明細</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">商品</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">數量</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">單位</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">單價</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">小計</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">已出貨</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {order.items.map(item => {
                const lineTotal = parseFloat(item.unitPrice.toString()) * item.quantity
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
                      <span className={item.shippedQty >= item.quantity ? 'text-green-600 font-medium' : 'text-gray-500'}>
                        {item.shippedQty.toLocaleString()}
                      </span>
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
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 客戶 PO 關聯面板 */}
        <CustomerPoPanel
          orderId={order.id}
          customerPoNo={order.customerPoNo ?? null}
          items={order.items.map(i => ({
            id: i.id,
            productName: i.product.name,
            sku: i.product.sku ?? null,
            customerSkuRef: i.customerSkuRef ?? null,
          }))}
        />

        {/* PI 管理面板 */}
        <SalesPIPanel
          orderId={order.id}
          orderStatus={order.status}
          currencyCode={order.currencyCode}
          items={order.items.map(i => ({
            id: i.id,
            quantity: i.quantity,
            shippedQty: i.shippedQty,
            unit: i.unit,
            product: i.product,
          }))}
          pis={order.pis.map(pi => ({
            id: pi.id,
            piNo: pi.piNo,
            status: pi.status,
            estimatedShipDate: pi.estimatedShipDate?.toISOString() ?? null,
            performedAt: pi.performedAt.toISOString(),
          }))}
        />

        <SalesShipmentPanel
          orderId={order.id}
          orderStatus={order.status}
          items={order.items.map(i => ({
            id: i.id,
            quantity: i.quantity,
            shippedQty: i.shippedQty,
            unit: i.unit,
            product: i.product,
          }))}
          activePIs={order.pis
            .filter(pi => pi.status === 0)
            .map(pi => ({
              id: pi.id,
              piNo: pi.piNo,
              estimatedShipDate: pi.estimatedShipDate?.toISOString() ?? null,
            }))
          }
          shipments={order.shipments.map(s => ({
            id: s.id,
            shipmentNo: s.shipmentNo,
            actualShipDate: s.actualShipDate.toISOString(),
            shippingMethod: s.shippingMethod,
            portOfLoading: s.portOfLoading,
            portOfDischarge: s.portOfDischarge,
            trackingNo: s.trackingNo,
            packingListNo: s.packingListNo ?? null,
            commercialInvNo: s.commercialInvNo ?? null,
            note: s.note ?? null,
            source: s.source,
            performedAt: s.performedAt.toISOString(),
            performerName: s.performer?.name ?? null,
            items: s.items.map(si => ({
              id: si.id,
              productName: si.slsItem.product.name,
              sku: si.slsItem.product.sku ?? null,
              quantity: si.quantity,
              cartons: si.cartons ?? null,
              grossWeightKg: si.grossWeightKg != null ? parseFloat(si.grossWeightKg.toString()) : null,
              cbm: si.cbm != null ? parseFloat(si.cbm.toString()) : null,
            })),
          }))}
        />

        <p className="text-xs text-gray-400">
          操作者：{order.performer?.name ?? '-'}　操作時間：{formatDate(order.performedAt)}
        </p>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 shrink-0 w-28">{label}</span>
      <span className="text-gray-800">{value || '-'}</span>
    </div>
  )
}
