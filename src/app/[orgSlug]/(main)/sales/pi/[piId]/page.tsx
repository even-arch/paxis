export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPagePrisma } from '@/lib/page-db'
import { orgPath } from '@/lib/org-path'
import { formatDate } from '@/lib/utils'
import LinkPOButton from './LinkPOButton'
import UnlinkPOButton from './UnlinkPOButton'

type Props = { params: { orgSlug: string; piId: string } }

export default async function PIDetailPage({ params }: Props) {
  const prisma = await getPagePrisma(params.orgSlug)
  const piId = Number(params.piId)
  if (isNaN(piId)) notFound()

  const pi = await prisma.pI.findUnique({
    where: { id: piId },
    include: {
      customer: true,
      order: { select: { id: true, orderNo: true, currencyCode: true, totalAmount: true, customer: true } },
      items: {
        include: {
          product: { select: { sku: true, name: true, modelNo: true, specification: true } },
          slsItem: { include: { product: { select: { sku: true, name: true, modelNo: true, specification: true } } } },
        },
      },
      // 反向：哪些 PO 直接連結了這張 PI（slsPiId FK）
      poOrders: {
        select: {
          id: true, poNo: true, status: true, totalAmount: true, currencyCode: true,
          supplier: { select: { id: true, name: true, shortName: true } },
        },
      },
    },
  })
  if (!pi) notFound()

  // 若 slsPiId FK 找不到，fallback 用 poNo=piNo 字串比對，並自動補上 slsPiId
  let linkedPOs = pi.poOrders.length > 0
    ? pi.poOrders
    : await prisma.pO.findMany({
        where: { poNo: pi.piNo },
        select: {
          id: true, poNo: true, status: true, totalAmount: true, currencyCode: true,
          supplier: { select: { id: true, name: true, shortName: true } },
        },
      })

  // fallback 命中時自動補 slsPiId，確保後續成本計算能用 FK 查到
  if (pi.poOrders.length === 0 && linkedPOs.length > 0) {
    await prisma.pO.updateMany({
      where: { id: { in: linkedPOs.map(p => p.id) }, slsPiId: null },
      data: { slsPiId: pi.id },
    })
  }

  // 取 PO 品項 SKU，用於覆蓋率檢查
  const linkedPOsWithItems = await prisma.pO.findMany({
    where: { slsPiId: pi.id },
    select: {
      id: true, poNo: true, status: true, totalAmount: true, currencyCode: true,
      supplier: { select: { id: true, name: true, shortName: true } },
      items: { select: { product: { select: { sku: true } } } },
    },
  })
  if (linkedPOsWithItems.length > 0) linkedPOs = linkedPOsWithItems

  // PI 品項 SKU 集合
  const piSkus = new Set(pi.items.map(i => i.slsItem?.product?.sku ?? i.product?.sku).filter(Boolean))
  const poSkus = new Set(linkedPOs.flatMap(po =>
    ('items' in po ? (po as typeof linkedPOsWithItems[0]).items.map(i => i.product?.sku) : [])
  ).filter(Boolean))
  const missingSkus = Array.from(piSkus).filter((sku): sku is string => sku != null && !poSkus.has(sku))

  const cust = pi.order?.customer ?? pi.customer
  const currencyCode = pi.order?.currencyCode ?? pi.currencyCode ?? ''
  const totalAmount = pi.order?.totalAmount ?? pi.totalAmount

  return (
    <div className="max-w-4xl mx-auto">
      {/* 麵包屑 */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href={orgPath(params.orgSlug, '/sales')} className="hover:text-gray-600">客戶訂單</Link>
        <span>›</span>
        <Link href={orgPath(params.orgSlug, '/sales/pi')} className="hover:text-gray-600">我方 PI 清單</Link>
        <span>›</span>
        <span className="text-gray-700 font-mono">{pi.piNo}</span>
      </div>

      {/* 標題列 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 font-mono">{pi.piNo}</h1>
          <div className="flex items-center gap-3 mt-1">
            {pi.status === 1
              ? <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">已取消</span>
              : pi.status === 2
              ? <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">已出貨</span>
              : <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">有效</span>
            }
            <span className="text-xs text-gray-400">來源：Patisco</span>
            {pi.patiscoDocId && <span className="text-xs text-gray-400 font-mono">Doc ID: {pi.patiscoDocId}</span>}
          </div>
        </div>
        {pi.order && (
          <Link href={orgPath(params.orgSlug, `/sales/${pi.order.id}`)}
            className="text-sm px-3 py-2 rounded-md border border-teal-300 text-teal-600 hover:bg-teal-50">
            查看對應訂單 {pi.order.orderNo}
          </Link>
        )}
      </div>

      {/* 主資訊卡 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div>
            <div className="text-gray-400 mb-0.5">客戶</div>
            <div className="font-medium text-gray-800">{cust?.name ?? <span className="text-gray-400">未對應</span>}</div>
            {cust?.address && <div className="text-gray-500 text-xs mt-0.5">{cust.address}</div>}
          </div>
          <div>
            <div className="text-gray-400 mb-0.5">幣別</div>
            <div className="font-medium text-gray-800">{currencyCode || '-'}</div>
          </div>
          <div>
            <div className="text-gray-400 mb-0.5">PI 日期</div>
            <div className="text-gray-800">{formatDate(pi.piDate)}</div>
          </div>
          <div>
            <div className="text-gray-400 mb-0.5">預計出貨日</div>
            <div className="text-gray-800">{formatDate(pi.estimatedShipDate)}</div>
          </div>
          {totalAmount && (
            <div>
              <div className="text-gray-400 mb-0.5">總金額</div>
              <div className="font-medium text-gray-800">
                {currencyCode} {Number(totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
          )}
          {pi.patiscoCreatedAt && (
            <div>
              <div className="text-gray-400 mb-0.5">Patisco 建立時間</div>
              <div className="text-gray-500 text-xs">{formatDate(pi.patiscoCreatedAt)}</div>
            </div>
          )}
        </div>
      </div>

      {/* 對應供應商採購單 */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg px-5 py-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">對應供應商採購單（PO）</p>
          <LinkPOButton piId={pi.id} linkedPOIds={linkedPOs.map(p => p.id)} />
        </div>
        {missingSkus.length > 0 && (
          <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs font-semibold text-red-600 mb-1">⚠ 以下 SKU 在已連結 PO 中找不到進價，毛利估算將不完整：</p>
            <p className="text-xs font-mono text-red-500">{missingSkus.join('、')}</p>
          </div>
        )}
        {linkedPOs.length === 0 ? (
          <p className="text-sm text-gray-400">尚未連結採購單，請點右側按鈕搜尋並連結。</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {linkedPOs.map(po => (
              <div key={po.id} className="inline-flex items-center gap-1 bg-white border border-orange-200 rounded-lg px-3 py-2 hover:border-orange-300 transition-colors text-sm">
                <Link href={orgPath(params.orgSlug, `/purchases/${po.id}`)} className="inline-flex items-center gap-2">
                  <span className="font-mono font-medium text-orange-700">{po.poNo}</span>
                  <span className="text-gray-500">{po.supplier.shortName ?? po.supplier.name}</span>
                  {po.totalAmount && (
                    <span className="text-xs text-gray-400">{po.currencyCode} {Number(po.totalAmount).toLocaleString()}</span>
                  )}
                  <span className="text-xs text-gray-400">→ 查看 PO</span>
                </Link>
                <UnlinkPOButton poId={po.id} poNo={po.poNo} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 品項清單 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">品項明細</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">品名 / 規格</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">數量</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">單位</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">單價</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">小計</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pi.items.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">無品項資料</td></tr>
            )}
            {pi.items.map(item => {
              const prod = item.slsItem?.product ?? item.product
              const subtotal = item.unitPrice && item.quantity
                ? Number(item.unitPrice) * item.quantity
                : null
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{prod?.sku ?? '-'}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-800">{prod?.name ?? '-'}</div>
                    {prod?.specification && <div className="text-gray-400 text-xs">{prod.specification}</div>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.quantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500">{item.unit ?? '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {item.unitPrice ? Number(item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">
                    {subtotal ? subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {totalAmount && (
            <tfoot className="border-t border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-right text-sm font-medium text-gray-600">合計</td>
                <td className="px-4 py-3 text-right font-bold text-gray-800">
                  {currencyCode} {Number(totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
