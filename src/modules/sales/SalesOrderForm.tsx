'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'TWD', 'HKD']

type DbCustomer = { id: number; name: string; shortName: string | null; currencyCode: string | null }
type DbProduct  = { id: number; name: string; sku: string | null; unit: string | null }

type LineItem = {
  productId: string
  qty: string
  unitPrice: string
  unit: string
}

type Props = {
  customers: DbCustomer[]
  products:  DbProduct[]
}

export default function SalesOrderForm({ customers, products }: Props) {
  const router = useRouter()
  const [customerId, setCustomerId]       = useState('')
  const [currencyCode, setCurrencyCode]   = useState('USD')
  const [exchangeRate, setExchangeRate]   = useState('')
  const [requestedShipDate, setRequestedShipDate] = useState('')
  const [paymentTerms, setPaymentTerms]   = useState('')
  const [note, setNote]                   = useState('')
  const [items, setItems] = useState<LineItem[]>([{ productId: '', qty: '', unitPrice: '', unit: 'PCS' }])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function addLine() {
    setItems(p => [...p, { productId: '', qty: '', unitPrice: '', unit: 'PCS' }])
  }
  function removeLine(idx: number) {
    setItems(p => p.filter((_, i) => i !== idx))
  }
  function setLine(idx: number, field: keyof LineItem, value: string) {
    setItems(p => p.map((it, i) => {
      if (i !== idx) return it
      const updated = { ...it, [field]: value }
      // 選商品時自動帶入單位
      if (field === 'productId') {
        const prod = products.find(p => p.id === Number(value))
        if (prod?.unit) updated.unit = prod.unit
      }
      return updated
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validItems = items.filter(i => i.productId && Number(i.qty) > 0)
    if (!validItems.length) { setError('請至少填入一項商品及數量'); return }

    setSaving(true); setError('')
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerId ? Number(customerId) : null,
          currencyCode,
          exchangeRate: exchangeRate || '1',
          customerRequestedShipDate: requestedShipDate || null,
          note: [paymentTerms ? `付款條件：${paymentTerms}` : '', note].filter(Boolean).join('\n') || null,
          source: 'MANUAL',
          items: validItems.map(i => ({
            productId: Number(i.productId),
            quantity: Number(i.qty),
            unitPrice: i.unitPrice || '0',
            unit: i.unit || null,
          })),
        }),
      })
      const json = await res.json() as { id?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? '建立失敗')
      router.push(`/sales/${json.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">訂單資料</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="客戶">
            <select value={customerId} onChange={e => {
              setCustomerId(e.target.value)
              const c = customers.find(c => c.id === Number(e.target.value))
              if (c?.currencyCode) setCurrencyCode(c.currencyCode)
            }} className={inp}>
              <option value="">請選擇客戶（可留空）</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.shortName ? ` (${c.shortName})` : ''}</option>
              ))}
            </select>
          </Field>
          <Field label="幣別">
            <select value={currencyCode} onChange={e => setCurrencyCode(e.target.value)} className={inp}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={`匯率（${currencyCode} → TWD）`}>
            <input type="number" step="0.000001" value={exchangeRate}
              onChange={e => setExchangeRate(e.target.value)} className={inp}
              placeholder={currencyCode === 'TWD' ? '1' : '請填入當日匯率'} />
          </Field>
          <Field label="客戶希望出貨日">
            <input type="date" value={requestedShipDate} onChange={e => setRequestedShipDate(e.target.value)} className={inp} />
          </Field>
          <Field label="付款條件">
            <input type="text" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
              className={inp} placeholder="T/T 30 days" />
          </Field>
          <div className="md:col-span-2">
            <Field label="備註">
              <textarea value={note} onChange={e => setNote(e.target.value)} className={`${inp} h-16`} />
            </Field>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-700">訂單明細</h2>
          <button type="button" onClick={addLine}
            className="text-sm text-blue-600 hover:underline">+ 新增品項</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">商品</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600 w-24">數量</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-16">單位</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600 w-28">單價 ({currencyCode})</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600 w-28">小計</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((item, idx) => (
              <tr key={idx}>
                <td className="px-4 py-2">
                  <select value={item.productId} onChange={e => setLine(idx, 'productId', e.target.value)} className={inp}>
                    <option value="">請選擇商品</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.sku ? ` — ${p.sku}` : ''}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input type="number" min="1" value={item.qty}
                    onChange={e => setLine(idx, 'qty', e.target.value)}
                    className={`${inp} text-right`} />
                </td>
                <td className="px-4 py-2">
                  <input type="text" value={item.unit}
                    onChange={e => setLine(idx, 'unit', e.target.value)}
                    className={inp} />
                </td>
                <td className="px-4 py-2">
                  <input type="number" step="0.0001" value={item.unitPrice}
                    onChange={e => setLine(idx, 'unitPrice', e.target.value)}
                    className={`${inp} text-right`} />
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-700">
                  {((Number(item.qty) || 0) * (Number(item.unitPrice) || 0)).toFixed(2)}
                </td>
                <td className="px-2 py-2">
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeLine(idx)}
                      className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50">
              <td colSpan={4} className="px-4 py-3 text-right font-medium text-gray-700">總金額</td>
              <td className="px-4 py-3 text-right font-bold text-gray-900">{currencyCode} {subtotal.toFixed(2)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </section>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-teal-600 text-white px-8 py-2.5 rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          {saving ? '建立中…' : '建立客戶訂單'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
          取消
        </button>
      </div>
    </form>
  )
}

const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
