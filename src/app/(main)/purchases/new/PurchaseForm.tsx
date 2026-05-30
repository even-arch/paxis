'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SHIP_VIA, CURRENCIES } from '@/modules/purchase/poUtils'

type Supplier = { id: number; name: string; shortName: string | null; currencyCode: string | null }
type Product = { id: number; name: string; sku: string | null; unit: string | null }
type LineItem = { productId: string; quantity: string; unitPrice: string; unit: string; note: string }

const emptyLine = (): LineItem => ({ productId: '', quantity: '', unitPrice: '', unit: '', note: '' })

export default function PurchaseForm({ suppliers, products }: { suppliers: Supplier[]; products: Product[] }) {
  const router = useRouter()
  const [supplierId, setSupplierId] = useState('')
  const [currencyCode, setCurrencyCode] = useState('USD')
  const [exchangeRate, setExchangeRate] = useState('1')
  const [expectedDate, setExpectedDate] = useState('')
  const [port, setPort] = useState('')
  const [shipVia, setShipVia] = useState('')
  const [patiscoOrderNo, setPatiscoOrderNo] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<LineItem[]>([emptyLine()])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function handleSupplierChange(id: string) {
    setSupplierId(id)
    const sup = suppliers.find(s => String(s.id) === id)
    if (sup?.currencyCode) setCurrencyCode(sup.currencyCode)
  }

  function setItem(idx: number, field: keyof LineItem, value: string) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
    // 自動帶入商品單位
    if (field === 'productId') {
      const p = products.find(p => String(p.id) === value)
      if (p?.unit) setItems(prev => prev.map((item, i) => i === idx ? { ...item, unit: p.unit ?? '' } : item))
    }
  }

  function addLine() { setItems(prev => [...prev, emptyLine()]) }
  function removeLine(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }

  const subtotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unitPrice) || 0
    return sum + qty * price
  }, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId) { setError('請選擇供應商'); return }
    const validItems = items.filter(i => i.productId && i.quantity && i.unitPrice)
    if (validItems.length === 0) { setError('請至少輸入一項採購明細'); return }

    setSaving(true)
    setError('')

    const res = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId, currencyCode, exchangeRate, expectedDate, port, shipVia,
        patiscoOrderNo, note,
        items: validItems.map(i => ({
          productId: Number(i.productId),
          quantity: Number(i.quantity),
          unitPrice: i.unitPrice,
          unit: i.unit,
          note: i.note,
        })),
      }),
    })

    setSaving(false)
    if (!res.ok) { setError('儲存失敗，請再試一次'); return }
    const data = await res.json()
    router.push(`/purchases/${data.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* 標頭 */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">採購資訊</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="Patisco 訂單號（溯源用）">
              <input type="text" value={patiscoOrderNo} onChange={e => setPatiscoOrderNo(e.target.value)}
                className={inp} placeholder="例：ORD-20240530-0001（從 Patisco 複製）" />
            </Field>
            <p className="text-xs text-gray-400 mt-1">此採購單對應的 Patisco 訂單，方便後續追蹤</p>
          </div>
          <Field label="供應商" required>
            <select value={supplierId} onChange={e => handleSupplierChange(e.target.value)} className={inp} required>
              <option value="">請選擇</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.shortName ?? s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="幣別">
            <select value={currencyCode} onChange={e => setCurrencyCode(e.target.value)} className={inp}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="匯率（對 TWD）">
            <input type="number" step="0.000001" value={exchangeRate}
              onChange={e => setExchangeRate(e.target.value)} className={inp} />
          </Field>
          <Field label="預計到貨日">
            <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className={inp} />
          </Field>
          <Field label="裝運港">
            <input type="text" value={port} onChange={e => setPort(e.target.value)}
              className={inp} placeholder="例：YANTIAN, SHANGHAI" />
          </Field>
          <Field label="運送方式">
            <select value={shipVia} onChange={e => setShipVia(e.target.value)} className={inp}>
              <option value="">請選擇</option>
              {SHIP_VIA.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="備註">
              <textarea value={note} onChange={e => setNote(e.target.value)} className={`${inp} h-20`}
                placeholder="付款條件、特殊要求等..." />
            </Field>
          </div>
        </div>
      </section>

      {/* 採購明細 */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">採購明細</h2>
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end border-b border-gray-50 pb-3">
              <div className="col-span-4">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">商品</label>}
                <select value={item.productId} onChange={e => setItem(idx, 'productId', e.target.value)} className={inp}>
                  <option value="">請選擇商品</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">數量</label>}
                <input type="number" min="1" value={item.quantity}
                  onChange={e => setItem(idx, 'quantity', e.target.value)} className={inp} placeholder="0" />
              </div>
              <div className="col-span-1">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">單位</label>}
                <input type="text" value={item.unit}
                  onChange={e => setItem(idx, 'unit', e.target.value)} className={inp} />
              </div>
              <div className="col-span-2">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">單價 ({currencyCode})</label>}
                <input type="number" step="0.0001" value={item.unitPrice}
                  onChange={e => setItem(idx, 'unitPrice', e.target.value)} className={inp} placeholder="0.00" />
              </div>
              <div className="col-span-2">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">小計</label>}
                <div className="px-3 py-2 text-sm text-gray-500 text-right">
                  {((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}
                </div>
              </div>
              <div className="col-span-1 flex justify-end">
                {items.length > 1 && (
                  <button type="button" onClick={() => removeLine(idx)}
                    className="text-red-400 hover:text-red-600 text-lg leading-none pb-2">×</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={addLine}
          className="mt-3 text-sm text-blue-600 hover:underline">
          + 新增一行
        </button>

        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
          <div className="text-right">
            <span className="text-sm text-gray-500">總金額：</span>
            <span className="text-lg font-semibold text-gray-800 ml-2">
              {currencyCode} {subtotal.toFixed(2)}
            </span>
          </div>
        </div>
      </section>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? '儲存中...' : '儲存草稿'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="border border-gray-300 text-gray-700 px-6 py-2 rounded-md text-sm hover:bg-gray-50">
          取消
        </button>
      </div>
    </form>
  )
}

const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}
