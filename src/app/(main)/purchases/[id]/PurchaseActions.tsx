'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Item = {
  id: number
  productName: string
  productSku: string | null
  quantity: number
  receivedQty: number
  unit: string
  unitPrice: string   // Decimal as string
  currencyCode: string
}

type Props = {
  orderId: string
  status: number
  items: Item[]
  defaultCurrency: string
  hasReceipts: boolean
}

interface ReceiveRow {
  qty: string
  unitCost: string
  currency: string
}

export default function PurchaseActions({ orderId, status, items, defaultCurrency, hasReceipts }: Props) {
  const router = useRouter()
  const [showReceive, setShowReceive] = useState(false)
  const [rows, setRows] = useState<Record<number, ReceiveRow>>({})
  const [receiveNote, setReceiveNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isDraft    = status === 0
  const canReceive = status === 1 || status === 2
  const canDelete  = !hasReceipts  // 有入庫紀錄就不能刪
  const pendingItems = items.filter(i => i.receivedQty < i.quantity)

  function initRows() {
    const init: Record<number, ReceiveRow> = {}
    pendingItems.forEach(item => {
      init[item.id] = {
        qty: String(item.quantity - item.receivedQty),
        unitCost: item.unitPrice,
        currency: item.currencyCode || defaultCurrency,
      }
    })
    setRows(init)
    setShowReceive(true)
  }

  function setRow(id: number, field: keyof ReceiveRow, value: string) {
    setRows(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  async function handleDelete() {
    const label = isDraft ? '刪除此草稿' : '取消此採購單'
    if (!confirm(`確定要${label}？此操作無法復原。`)) return
    setSubmitting(true)
    const res = await fetch(`/api/purchases/${orderId}`, { method: 'DELETE' })
    setSubmitting(false)
    if (res.ok) {
      router.push('/purchases')
      router.refresh()
    } else {
      const err = await res.json() as { error?: string }
      alert(err.error || '刪除失敗')
    }
  }

  async function handleSubmit() {
    if (!confirm('確定送出採購單？送出後無法修改內容。')) return
    setSubmitting(true)
    const res = await fetch(`/api/purchases/${orderId}/submit`, { method: 'POST' })
    setSubmitting(false)
    if (res.ok) { router.refresh() } else { alert('送出失敗') }
  }

  async function handleReceive() {
    const receiveItems = pendingItems
      .map(item => ({
        poItemId: item.id,
        quantity: Number(rows[item.id]?.qty ?? 0),
        unitCost: rows[item.id]?.unitCost ? Number(rows[item.id].unitCost) : undefined,
        currency: rows[item.id]?.currency || defaultCurrency,
      }))
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
      setRows({})
      router.refresh()
    } else {
      const err = await res.json()
      alert(err.error || '入庫失敗')
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {isDraft && (
          <>
            <Link href={`/purchases/${orderId}/edit`}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
              編輯
            </Link>
            <button onClick={handleDelete} disabled={submitting}
              className="border border-red-300 text-red-600 px-4 py-2 rounded-md text-sm hover:bg-red-50 disabled:opacity-50">
              刪除草稿
            </button>
            <button onClick={handleSubmit} disabled={submitting}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {submitting ? '送出中...' : '送出採購單'}
            </button>
          </>
        )}
        {!isDraft && canDelete && (
          <button onClick={handleDelete} disabled={submitting}
            className="border border-red-300 text-red-600 px-4 py-2 rounded-md text-sm hover:bg-red-50 disabled:opacity-50">
            取消採購單
          </button>
        )}
        {canReceive && pendingItems.length > 0 && (
          <button onClick={showReceive ? () => setShowReceive(false) : initRows}
            className={`px-4 py-2 rounded-md text-sm font-medium ${showReceive ? 'bg-gray-200 text-gray-700' : 'bg-green-600 text-white hover:bg-green-700'}`}>
            {showReceive ? '取消' : '確認入庫'}
          </button>
        )}
      </div>

      {/* 入庫確認面板 */}
      {showReceive && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-5 w-full max-w-2xl mt-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">入庫確認</h3>
          <p className="text-xs text-gray-400 mb-4">
            確認後資料將鎖定並寫入庫存記錄。請在此最後校正數量與實際成本。
          </p>

          <div className="space-y-1 mb-4">
            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_120px_80px] gap-2 text-xs text-gray-500 font-medium pb-1 border-b">
              <div>品項</div>
              <div className="text-right">入庫數量</div>
              <div className="text-right">實際成本（單價）</div>
              <div>幣別</div>
            </div>

            {pendingItems.map(item => (
              <div key={item.id} className="grid grid-cols-[1fr_80px_120px_80px] gap-2 items-center py-2 border-b border-gray-50">
                <div>
                  <div className="text-sm text-gray-700">{item.productName}</div>
                  <div className="text-xs text-gray-400">
                    {item.productSku && <span className="mr-2">SKU: {item.productSku}</span>}
                    待入庫：{item.quantity - item.receivedQty} {item.unit}
                  </div>
                </div>
                <input
                  type="number" min="0" max={item.quantity - item.receivedQty}
                  value={rows[item.id]?.qty ?? ''}
                  onChange={e => setRow(item.id, 'qty', e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm text-right w-full focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <input
                  type="number" min="0" step="0.0001"
                  value={rows[item.id]?.unitCost ?? ''}
                  onChange={e => setRow(item.id, 'unitCost', e.target.value)}
                  placeholder="成本"
                  className="border border-gray-300 rounded px-2 py-1 text-sm text-right w-full focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <input
                  type="text" maxLength={3}
                  value={rows[item.id]?.currency ?? defaultCurrency}
                  onChange={e => setRow(item.id, 'currency', e.target.value.toUpperCase())}
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            ))}
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">備註</label>
            <input type="text" value={receiveNote} onChange={e => setReceiveNote(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="驗貨備註..." />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4">
            <p className="text-xs text-amber-700">
              確認後此筆入庫記錄將鎖定，不可回頭修改。如有誤差請以新的入庫單補正。
            </p>
          </div>

          <button onClick={handleReceive} disabled={submitting}
            className="w-full bg-green-600 text-white py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {submitting ? '入庫中...' : '確認入庫並更新庫存'}
          </button>
        </div>
      )}
    </div>
  )
}
