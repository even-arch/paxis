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
  unitPrice: string
  currencyCode: string
}

type SupplierPI = {
  id: number
  piNo: string
  estimatedShipDate: string | null
  performedAt: string
  performerName: string | null
  items: { poItemId: number; confirmedQty: number; productName: string }[]
}

type Props = {
  orderId: string
  status: number
  items: Item[]
  defaultCurrency: string
  hasReceipts: boolean
  supplierPIs: SupplierPI[]
}

interface ReceiveRow { qty: string; unitCost: string; currency: string }

export default function PurchaseActions({ orderId, status, items, defaultCurrency, hasReceipts, supplierPIs }: Props) {
  const router = useRouter()

  // 入庫
  const [showReceive, setShowReceive] = useState(false)
  const [rows, setRows] = useState<Record<number, ReceiveRow>>({})
  const [receiveNote, setReceiveNote] = useState('')

  // 供應商 PI
  const [showPIForm, setShowPIForm] = useState(false)
  const [piNo, setPiNo] = useState('')
  const [piDate, setPiDate] = useState('')
  const [piNote, setPiNote] = useState('')
  const [piQtys, setPiQtys] = useState<Record<number, string>>({})

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isDraft = status === 0
  const canReceive = status === 1 || status === 2
  const canDelete = !hasReceipts
  const pendingItems = items.filter(i => i.receivedQty < i.quantity)

  function initReceive() {
    const init: Record<number, ReceiveRow> = {}
    pendingItems.forEach(item => {
      init[item.id] = { qty: String(item.quantity - item.receivedQty), unitCost: item.unitPrice, currency: item.currencyCode || defaultCurrency }
    })
    setRows(init)
    setShowReceive(true)
    setShowPIForm(false)
  }

  function initPIForm() {
    const init: Record<number, string> = {}
    items.forEach(i => { init[i.id] = String(i.quantity - i.receivedQty) })
    setPiQtys(init)
    setShowPIForm(true)
    setShowReceive(false)
  }

  function setRow(id: number, field: keyof ReceiveRow, value: string) {
    setRows(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  async function handleDelete() {
    const label = isDraft ? '刪除此草稿' : '取消此供應商訂單'
    if (!confirm(`確定要${label}？此操作無法復原。`)) return
    setSubmitting(true)
    const res = await fetch(`/api/purchases/${orderId}`, { method: 'DELETE' })
    setSubmitting(false)
    if (res.ok) { router.push('/purchases'); router.refresh() }
    else { const err = await res.json() as { error?: string }; alert(err.error || '刪除失敗') }
  }

  async function handleSubmit() {
    if (!confirm('確定送出供應商訂單？送出後無法修改內容。')) return
    setSubmitting(true)
    const res = await fetch(`/api/purchases/${orderId}/submit`, { method: 'POST' })
    setSubmitting(false)
    if (res.ok) router.refresh(); else alert('送出失敗')
  }

  async function handleReceive() {
    const receiveItems = pendingItems
      .map(item => ({ poItemId: item.id, quantity: Number(rows[item.id]?.qty ?? 0), unitCost: rows[item.id]?.unitCost ? Number(rows[item.id].unitCost) : undefined, currency: rows[item.id]?.currency || defaultCurrency }))
      .filter(i => i.quantity > 0)
    if (!receiveItems.length) { alert('請輸入至少一項入庫數量'); return }
    setSubmitting(true)
    const res = await fetch(`/api/purchases/${orderId}/receive`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: receiveItems, note: receiveNote }),
    })
    setSubmitting(false)
    if (res.ok) {
      const data = await res.json()
      alert(`入庫完成！入庫單號：${data.receiptNo}`)
      setShowReceive(false); setRows({}); router.refresh()
    } else { const err = await res.json(); alert(err.error || '入庫失敗') }
  }

  async function handleRecordPI() {
    if (!piNo.trim()) { setError('請填入供應商 PI 單號'); return }
    setError('')
    setSubmitting(true)
    const res = await fetch(`/api/purchases/${orderId}/supplier-pi`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        piNo: piNo.trim(),
        estimatedShipDate: piDate || null,
        note: piNote || null,
        items: items.map(i => ({ poItemId: i.id, confirmedQty: Number(piQtys[i.id] ?? 0) })),
      }),
    })
    setSubmitting(false)
    if (res.ok) {
      setPiNo(''); setPiDate(''); setPiNote('')
      setShowPIForm(false); router.refresh()
    } else {
      const err = await res.json() as { error?: string }
      setError(err.error ?? '記錄失敗')
    }
  }

  return (
    <div className="flex flex-col items-end gap-2 w-full max-w-2xl">
      {/* 操作按鈕列 */}
      <div className="flex gap-2 flex-wrap justify-end">
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
              {submitting ? '送出中...' : '送出供應商訂單'}
            </button>
          </>
        )}
        {!isDraft && canDelete && (
          <button onClick={handleDelete} disabled={submitting}
            className="border border-red-300 text-red-600 px-4 py-2 rounded-md text-sm hover:bg-red-50 disabled:opacity-50">
            取消供應商訂單
          </button>
        )}
        {canReceive && (
          <button onClick={showPIForm ? () => setShowPIForm(false) : initPIForm}
            className={`px-4 py-2 rounded-md text-sm font-medium ${showPIForm ? 'bg-gray-200 text-gray-700' : 'border border-amber-400 text-amber-700 hover:bg-amber-50'}`}>
            {showPIForm ? '取消' : '記錄供應商 PI'}
          </button>
        )}
        {canReceive && pendingItems.length > 0 && (
          <button onClick={showReceive ? () => setShowReceive(false) : initReceive}
            className={`px-4 py-2 rounded-md text-sm font-medium ${showReceive ? 'bg-gray-200 text-gray-700' : 'bg-green-600 text-white hover:bg-green-700'}`}>
            {showReceive ? '取消' : '確認入庫'}
          </button>
        )}
      </div>

      {error && (
        <div className="w-full bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-600 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-xs underline ml-2">關閉</button>
        </div>
      )}

      {/* 記錄供應商 PI 面板 */}
      {showPIForm && (
        <div className="bg-white border border-amber-200 rounded-lg shadow-lg p-5 w-full mt-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">記錄供應商 PI 副本</h3>
          <p className="text-xs text-gray-400 mb-4">收到供應商發來的 PI 後填入，記錄預計出貨資訊。此步驟不影響庫存。</p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">供應商 PI 單號 <span className="text-red-500">*</span></label>
              <input type="text" value={piNo} onChange={e => setPiNo(e.target.value)}
                placeholder="供應商的 PI 號碼" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">供應商預計出貨日</label>
              <input type="date" value={piDate} onChange={e => setPiDate(e.target.value)} className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">備註</label>
              <input type="text" value={piNote} onChange={e => setPiNote(e.target.value)} className={inp} />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-2">供應商確認數量（可留 0 表示未確認）</label>
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_100px_60px] gap-2 text-xs text-gray-400 pb-1 border-b">
                <div>品項</div><div className="text-right">確認數量</div><div>單位</div>
              </div>
              {items.map(item => (
                <div key={item.id} className="grid grid-cols-[1fr_100px_60px] gap-2 items-center py-1.5 border-b border-gray-50">
                  <div className="text-sm text-gray-700">
                    {item.productName}
                    {item.productSku && <span className="text-xs text-gray-400 ml-1">({item.productSku})</span>}
                    <span className="text-xs text-gray-400 ml-1">×{item.quantity}</span>
                  </div>
                  <input type="number" min="0" max={item.quantity}
                    value={piQtys[item.id] ?? ''}
                    onChange={e => setPiQtys(p => ({ ...p, [item.id]: e.target.value }))}
                    className="border border-gray-300 rounded px-2 py-1 text-sm text-right w-full focus:outline-none focus:ring-1 focus:ring-amber-400" />
                  <span className="text-sm text-gray-500">{item.unit}</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleRecordPI} disabled={submitting}
            className="w-full bg-amber-500 text-white py-2 rounded-md text-sm font-medium hover:bg-amber-600 disabled:opacity-50">
            {submitting ? '記錄中...' : '確認記錄供應商 PI'}
          </button>
        </div>
      )}

      {/* 供應商 PI 紀錄（已記錄的）*/}
      {supplierPIs.length > 0 && !showPIForm && (
        <div className="w-full bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-xs font-medium text-amber-700 mb-2">供應商 PI 紀錄</p>
          <div className="space-y-2">
            {supplierPIs.map(pi => (
              <div key={pi.id} className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono font-medium text-gray-700">{pi.piNo}</span>
                  {pi.estimatedShipDate && (
                    <span className="ml-2 text-gray-500">預計出貨：{pi.estimatedShipDate.slice(0, 10)}</span>
                  )}
                </div>
                <span className="text-gray-400">{new Date(pi.performedAt).toLocaleDateString('zh-TW')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 入庫確認面板 */}
      {showReceive && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-5 w-full mt-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">入庫確認</h3>
          <p className="text-xs text-gray-400 mb-4">確認後資料將鎖定並寫入庫存記錄。請在此最後校正數量與實際成本。</p>

          <div className="space-y-1 mb-4">
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
                <input type="number" min="0" max={item.quantity - item.receivedQty}
                  value={rows[item.id]?.qty ?? ''}
                  onChange={e => setRow(item.id, 'qty', e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm text-right w-full focus:outline-none focus:ring-1 focus:ring-green-500" />
                <input type="number" min="0" step="0.0001"
                  value={rows[item.id]?.unitCost ?? ''}
                  onChange={e => setRow(item.id, 'unitCost', e.target.value)}
                  placeholder="成本"
                  className="border border-gray-300 rounded px-2 py-1 text-sm text-right w-full focus:outline-none focus:ring-1 focus:ring-green-500" />
                <input type="text" maxLength={3}
                  value={rows[item.id]?.currency ?? defaultCurrency}
                  onChange={e => setRow(item.id, 'currency', e.target.value.toUpperCase())}
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-green-500" />
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
            <p className="text-xs text-amber-700">確認後此筆入庫記錄將鎖定，不可回頭修改。如有誤差請以新的入庫單補正。</p>
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

const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400'
