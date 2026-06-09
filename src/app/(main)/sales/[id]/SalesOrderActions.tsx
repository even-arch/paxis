'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ─── 刪除整張訂單（草稿用）──────────────────────────────────────────────────

export function DeleteSalesOrderButton({ orderId }: { orderId: number }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/sales/${orderId}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) { router.push('/sales'); router.refresh() }
    else { const err = await res.json() as { error?: string }; alert(err.error ?? '刪除失敗') }
  }

  if (confirm) {
    return (
      <span className="inline-flex items-center gap-2">
        <button onClick={handleDelete} disabled={deleting}
          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
          {deleting ? '刪除中…' : '確認刪除'}
        </button>
        <button onClick={() => setConfirm(false)} className="text-sm text-gray-500 hover:text-gray-700">取消</button>
      </span>
    )
  }

  return (
    <button onClick={() => setConfirm(true)}
      className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50">
      刪除草稿
    </button>
  )
}

// ─── 送出訂單（草稿→確認）──────────────────────────────────────────────────

export function SubmitSalesOrderButton({ orderId }: { orderId: number }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!confirm('確定送出訂單？送出後將進入確認狀態，可繼續開立 PI 及出貨。')) return
    setSubmitting(true)
    const res = await fetch(`/api/sales/${orderId}/submit`, { method: 'POST' })
    setSubmitting(false)
    if (res.ok) router.refresh()
    else { const err = await res.json() as { error?: string }; alert(err.error ?? '送出失敗') }
  }

  return (
    <button onClick={handleSubmit} disabled={submitting}
      className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium">
      {submitting ? '送出中…' : '送出客戶訂單'}
    </button>
  )
}

// ─── 訂單表頭編輯 ────────────────────────────────────────────────────────────

type EditHeaderProps = {
  orderId: number
  currencyCode: string
  exchangeRate: string
  note: string | null
  customerRequestedShipDate: string | null
}

export function EditOrderHeaderButton(props: EditHeaderProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [currency, setCurrency] = useState(props.currencyCode)
  const [rate, setRate] = useState(props.exchangeRate)
  const [note, setNote] = useState(props.note ?? '')
  const [shipDate, setShipDate] = useState(props.customerRequestedShipDate?.slice(0, 10) ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const CURRENCIES = ['USD', 'EUR', 'TWD', 'JPY', 'CNY', 'GBP']

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/sales/${props.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currencyCode: currency,
          exchangeRate: rate,
          note: note || null,
          customerRequestedShipDate: shipDate || null,
        }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? '更新失敗')
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded hover:bg-gray-50">
        ✏️ 編輯
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-gray-800">編輯訂單資訊</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">幣別</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value={currency}>{currency}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">匯率（對 TWD）</label>
                <input type="number" step="0.0001" value={rate} onChange={e => setRate(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">客戶希望出貨日</label>
                <input type="date" value={shipDate} onChange={e => setShipDate(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">備註</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <div className="px-5 py-3 border-t flex justify-end gap-2">
              <button onClick={() => setOpen(false)}
                className="border border-gray-300 text-gray-600 px-4 py-1.5 rounded text-sm hover:bg-gray-50">
                取消
              </button>
              <button onClick={handleSave} disabled={saving}
                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── 刪除單筆品項 ─────────────────────────────────────────────────────────────

export function DeleteSalesItemButton({ orderId, itemId }: { orderId: number; itemId: number }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/sales/${orderId}/items?itemId=${itemId}`, { method: 'DELETE' })
      const json = await res.json() as { error?: string }
      if (!res.ok) { alert(json.error ?? '刪除失敗'); return }
      router.refresh()
    } finally {
      setDeleting(false)
      setConfirm(false)
    }
  }

  if (confirm) {
    return (
      <span className="inline-flex items-center gap-1">
        <button onClick={handleDelete} disabled={deleting}
          className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700 disabled:opacity-50">
          {deleting ? '…' : '確認刪除'}
        </button>
        <button onClick={() => setConfirm(false)} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
      </span>
    )
  }

  return (
    <button onClick={() => setConfirm(true)}
      className="text-xs text-red-400 hover:text-red-600 hover:underline">
      刪除
    </button>
  )
}
