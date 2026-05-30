'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Item = { id: number; productName: string; quantity: number; receivedQty: number; unit: string }

type Props = {
  orderId: string
  status: number
  items: Item[]
}

export default function PurchaseActions({ orderId, status, items }: Props) {
  const router = useRouter()
  const [showReceive, setShowReceive] = useState(false)
  const [receiving, setReceiving] = useState<Record<number, string>>({})
  const [receiveNote, setReceiveNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isDraft = status === 0
  const canReceive = status === 1 || status === 2

  async function handleSubmit() {
    if (!confirm('確定送出採購單？送出後無法修改內容。')) return
    setSubmitting(true)
    const res = await fetch(`/api/purchases/${orderId}/submit`, { method: 'POST' })
    setSubmitting(false)
    if (res.ok) { router.refresh() } else { alert('送出失敗') }
  }

  async function handleReceive() {
    const receiveItems = items
      .map(item => ({ poItemId: item.id, quantity: Number(receiving[item.id] || 0) }))
      .filter(i => i.quantity > 0)

    if (receiveItems.length === 0) { alert('請輸入至少一項入庫數量'); return }

    setSubmitting(true)
    const res = await fetch(`/api/purchases/${orderId}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: receiveItems, note: receiveNote }),
    })
    setSubmitting(false)

    if (res.ok) {
      const data = await res.json()
      alert(`入庫完成！入庫單號：${data.receiptNo}`)
      setShowReceive(false)
      setReceiving({})
      router.refresh()
    } else {
      const err = await res.json()
      alert(err.error || '入庫失敗')
    }
  }

  const pendingItems = items.filter(i => i.receivedQty < i.quantity)

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {isDraft && (
          <>
            <Link href={`/purchases/${orderId}/edit`}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
              編輯
            </Link>
            <button onClick={handleSubmit} disabled={submitting}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {submitting ? '送出中...' : '送出採購單'}
            </button>
          </>
        )}
        {canReceive && pendingItems.length > 0 && (
          <button onClick={() => setShowReceive(!showReceive)}
            className={`px-4 py-2 rounded-md text-sm font-medium ${showReceive ? 'bg-gray-200 text-gray-700' : 'bg-green-600 text-white hover:bg-green-700'}`}>
            {showReceive ? '取消入庫' : '確認入庫'}
          </button>
        )}
      </div>

      {/* 入庫表單 */}
      {showReceive && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-5 w-96">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">入庫確認</h3>
          <div className="space-y-3">
            {pendingItems.map(item => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="flex-1 text-sm">
                  <div className="text-gray-700">{item.productName}</div>
                  <div className="text-xs text-gray-400">
                    待入庫：{item.quantity - item.receivedQty} {item.unit}
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  max={item.quantity - item.receivedQty}
                  value={receiving[item.id] ?? ''}
                  onChange={e => setReceiving(prev => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder="0"
                  className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <span className="text-xs text-gray-400 w-8">{item.unit}</span>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <label className="block text-xs text-gray-500 mb-1">備註</label>
            <input type="text" value={receiveNote} onChange={e => setReceiveNote(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="驗貨備註..." />
          </div>
          <button onClick={handleReceive} disabled={submitting}
            className="mt-3 w-full bg-green-600 text-white py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {submitting ? '入庫中...' : '確認入庫並更新庫存'}
          </button>
        </div>
      )}
    </div>
  )
}
