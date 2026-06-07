'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type OrderItem = {
  id: number
  quantity: number
  shippedQty: number
  unit: string | null
  product: { id: number; name: string; sku: string | null; unit: string | null }
}

type ExistingPI = {
  id: number
  piNo: string
  status: number
  estimatedShipDate: string | null
  performedAt: string
}

type Props = {
  orderId: number
  orderStatus: number
  currencyCode: string
  items: OrderItem[]
  pis: ExistingPI[]
}

export default function SalesPIPanel({ orderId, orderStatus, items, pis }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [estimatedShipDate, setEstimatedShipDate] = useState('')
  const [piItems, setPiItems] = useState<{ slsItemId: number; quantity: string }[]>(
    items.map(i => ({ slsItemId: i.id, quantity: String(i.quantity) }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 取消 PI
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const canIssuePi = orderStatus !== 4 && orderStatus !== 5

  async function handleIssuePi(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/sales/${orderId}/pi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimatedShipDate: estimatedShipDate || null,
          items: piItems
            .filter(i => Number(i.quantity) > 0)
            .map(i => ({ slsItemId: i.slsItemId, quantity: Number(i.quantity) })),
        }),
      })
      const json = await res.json() as { piNo?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? '發出失敗')
      setShowForm(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleCancelPi(piId: number) {
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/sales/pi/${piId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? '取消失敗')
      setCancellingId(null)
      setCancelReason('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-700">PI 管理</h2>
          <p className="text-xs text-gray-400 mt-0.5">發出 PI 正本後，系統自動預留對應庫存（reservedQty++）</p>
        </div>
        {canIssuePi && !showForm && (
          <div className="flex gap-2">
            <Link href={`/sales/${orderId}/pi-import`}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700">
              ✨ 匯入 PI 文件
            </Link>
            <button onClick={() => setShowForm(true)}
              className="border border-purple-300 text-purple-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-50">
              + 手動發出 PI
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="underline text-xs ml-4">關閉</button>
        </div>
      )}

      {/* 發出 PI 表單 */}
      {showForm && (
        <form onSubmit={handleIssuePi} className="p-6 border-b border-gray-100 bg-purple-50">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">填寫 PI 資料</h3>
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              預計出貨日（Estimated Ship Date）
            </label>
            <input type="date" value={estimatedShipDate} onChange={e => setEstimatedShipDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-48" />
            <p className="text-xs text-gray-400 mt-1">此日期會顯示在 PI 上，用於追蹤出貨進度</p>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-2">本次 PI 數量</label>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-200">
                  <th className="text-left pb-2 font-normal">商品</th>
                  <th className="text-right pb-2 font-normal w-24">訂單數量</th>
                  <th className="text-right pb-2 font-normal w-24">本次 PI</th>
                  <th className="text-left pb-2 font-normal w-16">單位</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="py-2">
                      <span className="font-medium text-gray-800">{item.product.name}</span>
                      {item.product.sku && <span className="text-gray-400 text-xs ml-1">({item.product.sku})</span>}
                    </td>
                    <td className="py-2 text-right text-gray-500">{item.quantity.toLocaleString()}</td>
                    <td className="py-2 pr-2">
                      <input type="number" min="0" max={item.quantity}
                        value={piItems[idx]?.quantity ?? ''}
                        onChange={e => setPiItems(p => p.map((pi, i) => i === idx ? { ...pi, quantity: e.target.value } : pi))}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
                    </td>
                    <td className="py-2 text-gray-500">{item.unit ?? item.product.unit ?? 'PCS'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="bg-purple-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
              {saving ? '發出中…' : '✓ 確認發出 PI，預留庫存'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError('') }}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
              取消
            </button>
          </div>
        </form>
      )}

      {/* 現有 PI 列表 */}
      {pis.length === 0 && !showForm ? (
        <div className="px-6 py-8 text-center text-gray-400 text-sm">
          尚未發出任何 PI
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {pis.map(pi => (
            <div key={pi.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-medium text-gray-800">{pi.piNo}</span>
                  {pi.status === 0
                    ? <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">有效</span>
                    : <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">已取消</span>
                  }
                  {pi.estimatedShipDate && (
                    <span className="text-xs text-gray-500">
                      預計出貨：<span className="text-gray-700">{pi.estimatedShipDate.slice(0, 10)}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{new Date(pi.performedAt).toLocaleDateString('zh-TW')}</span>
                  {pi.status === 0 && (
                    cancellingId === pi.id ? (
                      <div className="flex items-center gap-2">
                        <input type="text" value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                          placeholder="取消原因（選填）"
                          className="border border-gray-300 rounded px-2 py-1 text-xs w-40 focus:outline-none" />
                        <button onClick={() => handleCancelPi(pi.id)} disabled={saving}
                          className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 disabled:opacity-50">
                          確認取消
                        </button>
                        <button onClick={() => { setCancellingId(null); setCancelReason('') }}
                          className="border border-gray-300 text-gray-600 px-3 py-1 rounded text-xs hover:bg-gray-50">
                          返回
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setCancellingId(pi.id)}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline">
                        取消此 PI
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
