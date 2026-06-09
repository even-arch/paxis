'use client'

/**
 * ItemTableActions — 採購/銷售訂單品項的行內編輯元件
 *
 * 提供：
 *   EditItemButton   — 每行右側的「編輯」按鈕，展開後原位編輯 qty + price + unit
 *   AddItemPanel     — 表格底部「新增品項」面板（需傳入 products 清單）
 *   DeleteItemButton — 帶「確認刪除」的刪除按鈕
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ProductPicker from './ProductPicker'

type Product = { id: number; name: string; sku: string | null; unit: string | null }

// ─── EditItemButton ────────────────────────────────────────────────────────────

interface EditItemProps {
  apiUrl:    string   // e.g. /api/purchases/5/items?itemId=12
  method?:   'PATCH'  // 預設 PATCH
  initQty:   number
  initPrice: string
  initUnit:  string
}

export function EditItemButton({ apiUrl, initQty, initPrice, initUnit }: EditItemProps) {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [qty,     setQty]     = useState(String(initQty))
  const [price,   setPrice]   = useState(initPrice)
  const [unit,    setUnit]    = useState(initUnit)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function save() {
    if (!qty || !price) { setError('數量與單價為必填'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(apiUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: qty, unitPrice: price, unit }),
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

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-xs text-blue-500 hover:text-blue-700 hover:underline">
        編輯
      </button>
    )
  }

  return (
    <span className="inline-flex flex-col gap-1 min-w-[280px]">
      <span className="flex items-center gap-1">
        <input type="number" min="1" step="1" value={qty}
          onChange={e => setQty(e.target.value)}
          className="w-20 border border-blue-300 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="數量" />
        <span className="text-xs text-gray-400">×</span>
        <input type="number" min="0" step="0.0001" value={price}
          onChange={e => setPrice(e.target.value)}
          className="w-24 border border-blue-300 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="單價" />
        <input type="text" maxLength={6} value={unit}
          onChange={e => setUnit(e.target.value.toUpperCase())}
          className="w-14 border border-blue-300 rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="單位" />
        <button onClick={save} disabled={saving}
          className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? '…' : '存'}
        </button>
        <button onClick={() => { setOpen(false); setError('') }}
          className="text-xs text-gray-400 hover:text-gray-600">取消</button>
      </span>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </span>
  )
}

// ─── AddItemPanel ─────────────────────────────────────────────────────────────

interface AddItemProps {
  apiUrl:   string    // e.g. /api/purchases/5/items
  products: Product[]
  currency: string
  orderId:  number
}

export function AddItemPanel({ apiUrl, products, currency }: AddItemProps) {
  const router = useRouter()
  const [open,      setOpen]      = useState(false)
  const [productId, setProductId] = useState('')
  const [qty,       setQty]       = useState('')
  const [price,     setPrice]     = useState('')
  const [unit,      setUnit]      = useState('PCS')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  function reset() {
    setProductId(''); setQty(''); setPrice(''); setUnit('PCS')
    setError(''); setOpen(false)
  }

  async function handleAdd() {
    if (!productId) { setError('請選擇商品'); return }
    if (!qty || Number(qty) <= 0) { setError('請輸入有效數量'); return }
    if (!price) { setError('請輸入單價'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: Number(productId), quantity: Number(qty), unitPrice: price, unit }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? '新增失敗')
      reset()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="mt-2 w-full text-xs text-blue-600 border border-dashed border-blue-300 rounded-md py-2 hover:bg-blue-50 hover:border-blue-500 transition-colors">
        + 新增品項
      </button>
    )
  }

  return (
    <div className="mt-2 border border-blue-200 rounded-lg bg-blue-50 p-4">
      <p className="text-xs font-medium text-blue-700 mb-3">新增品項</p>
      <div className="grid grid-cols-1 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">商品</label>
          <ProductPicker
            products={products}
            value={productId}
            onChange={(id, u) => { setProductId(id); setUnit(u || 'PCS') }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">數量</label>
            <input type="number" min="1" step="1" value={qty} onChange={e => setQty(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">單價（{currency}）</label>
            <input type="number" min="0" step="0.0001" value={price} onChange={e => setPrice(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">單位</label>
            <input type="text" maxLength={6} value={unit} onChange={e => setUnit(e.target.value.toUpperCase())}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      <div className="flex gap-2 mt-3">
        <button onClick={handleAdd} disabled={saving}
          className="flex-1 bg-blue-600 text-white text-sm py-1.5 rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? '新增中…' : '新增'}
        </button>
        <button onClick={reset}
          className="px-4 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
          取消
        </button>
      </div>
    </div>
  )
}

// ─── DeleteItemButton ─────────────────────────────────────────────────────────

interface DeleteItemProps {
  apiUrl: string   // e.g. /api/purchases/5/items?itemId=12
}

export function DeleteItemButton({ apiUrl }: DeleteItemProps) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(apiUrl, { method: 'DELETE' })
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
          {deleting ? '…' : '確認'}
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
