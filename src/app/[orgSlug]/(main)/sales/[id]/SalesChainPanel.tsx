'use client'

/**
 * SalesChainPanel — 交易鏈視圖
 *
 * 以 SKU 為粒度，顯示這張客戶訂單底下的供應商訂單狀態，
 * 以及每個品項的「買價 vs 賣價」毛利比對。
 */

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { orgPath } from '@/lib/org-path'
import { formatCurrency } from '@/lib/utils'

const PO_STATUS: Record<number, { label: string; color: string }> = {
  0: { label: '草稿',    color: 'bg-gray-100 text-gray-500' },
  1: { label: '已送出',  color: 'bg-blue-100 text-blue-700' },
  2: { label: '部分到貨', color: 'bg-amber-100 text-amber-700' },
  3: { label: '完成',    color: 'bg-green-100 text-green-700' },
  4: { label: '取消',    color: 'bg-red-100 text-red-500' },
}

type SLSItem = {
  productId: number
  productName: string
  productSku: string | null
  sellQty: number
  sellPrice: number    // 賣價（PO_CustomerCopy_Item.unitPrice）
  sellCurrency: string
}

type POItem = {
  productId: number
  buyQty: number
  buyPrice: number     // 買價（PO_Item.unitPrice）
  buyCurrency: string
}

type LinkedPO = {
  id: number
  poNo: string
  status: number
  supplierName: string
  createdAt: Date
  hasReceipt: boolean
  estimatedShipDate: Date | null
  items: POItem[]
}

type Props = {
  salesOrderId: number
  salesOrderNo: string
  sellCurrency: string
  slsItems: SLSItem[]
  linkedPOs: LinkedPO[]
}

export default function SalesChainPanel({
  salesOrderNo,
  sellCurrency,
  slsItems,
  linkedPOs,
}: Props) {
  const params = useParams<{ orgSlug?: string }>()
  const slug = typeof params?.orgSlug === 'string' ? params.orgSlug : ''
  if (linkedPOs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-3">交易鏈</h2>
        <p className="text-sm text-gray-400">尚無關聯供應商訂單。建立供應商訂單時請選擇此客戶訂單作為來源。</p>
      </div>
    )
  }

  // 建立 productId → 所有相關 PO 買價的 map（取最新一筆 / 加權平均）
  const buyMap = new Map<number, { totalQty: number; totalAmt: number; currency: string }>()
  for (const po of linkedPOs) {
    for (const item of po.items) {
      const existing = buyMap.get(item.productId)
      if (existing) {
        existing.totalQty += item.buyQty
        existing.totalAmt += item.buyQty * item.buyPrice
      } else {
        buyMap.set(item.productId, {
          totalQty: item.buyQty,
          totalAmt: item.buyQty * item.buyPrice,
          currency: item.buyCurrency,
        })
      }
    }
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-700">交易鏈</h2>
        <span className="text-xs text-gray-400">{linkedPOs.length} 張供應商訂單</span>
      </div>

      {/* ── 供應商訂單狀態列表 ─────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">供應商訂單</p>
        <div className="flex flex-wrap gap-3">
          {linkedPOs.map(po => {
            const st = PO_STATUS[po.status] ?? PO_STATUS[0]
            return (
              <Link key={po.id} href={slug ? orgPath(slug, `/purchases/${po.id}`) : `/purchases/${po.id}`}
                className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <span className="font-mono font-medium text-gray-800">{po.poNo}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500 text-xs">{po.supplierName}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${st.color}`}>{st.label}</span>
                {po.hasReceipt && (
                  <span className="text-green-500 text-xs font-medium">✓ 已入庫</span>
                )}
                {po.estimatedShipDate && !po.hasReceipt && (
                  <span className="text-gray-400 text-xs">
                    預計 {po.estimatedShipDate.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── SKU 買賣比對 ──────────────────────────────────────────────────── */}
      <div className="px-6 py-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">買賣價比對</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="pb-2 font-medium">商品</th>
              <th className="pb-2 font-medium text-right pr-4">賣出數量</th>
              <th className="pb-2 font-medium text-right pr-4">賣價</th>
              <th className="pb-2 font-medium text-right pr-4">買價</th>
              <th className="pb-2 font-medium text-right pr-4">毛利/件</th>
              <th className="pb-2 font-medium text-right">毛利率</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {slsItems.map(item => {
              const buy = buyMap.get(item.productId)
              const avgBuyPrice = buy ? buy.totalAmt / buy.totalQty : null
              const margin = avgBuyPrice != null ? item.sellPrice - avgBuyPrice : null
              const marginPct = margin != null && avgBuyPrice ? (margin / item.sellPrice) * 100 : null

              const marginColor = marginPct == null
                ? 'text-gray-300'
                : marginPct >= 20 ? 'text-green-600 font-medium'
                : marginPct >= 10 ? 'text-amber-600'
                : 'text-red-500 font-medium'

              return (
                <tr key={item.productId} className="hover:bg-gray-50">
                  <td className="py-3 pr-4">
                    <div className="font-medium text-gray-800">{item.productName}</div>
                    {item.productSku && (
                      <div className="text-xs text-gray-400 font-mono">{item.productSku}</div>
                    )}
                  </td>
                  <td className="py-3 text-right pr-4 text-gray-700">
                    {item.sellQty.toLocaleString()}
                  </td>
                  <td className="py-3 text-right pr-4 text-gray-700">
                    {formatCurrency(item.sellPrice, sellCurrency)}
                  </td>
                  <td className="py-3 text-right pr-4">
                    {avgBuyPrice != null ? (
                      <span className="text-gray-700">
                        {formatCurrency(avgBuyPrice, buy?.currency ?? sellCurrency)}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">無採購紀錄</span>
                    )}
                  </td>
                  <td className={`py-3 text-right pr-4 ${marginColor}`}>
                    {margin != null ? formatCurrency(margin, sellCurrency) : '—'}
                  </td>
                  <td className={`py-3 text-right ${marginColor}`}>
                    {marginPct != null ? `${marginPct.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {slsItems.some(i => !buyMap.has(i.productId)) && (
          <p className="text-xs text-gray-400 mt-3">
            * 部分品項尚無關聯供應商訂單，買價無法計算。請在供應商訂單建立時選擇此客戶訂單作為來源。
          </p>
        )}
      </div>
    </div>
  )
}
