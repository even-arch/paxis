'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOrgPath } from '@/lib/use-org-path'
import { SHIP_VIA, CURRENCIES } from '@/modules/purchase/poUtils'

type Supplier = { id: number; name: string; shortName: string | null; currencyCode: string | null }
type Order = {
  id: number; supplierId: number; currencyCode: string; exchangeRate: { toString(): string };
  expectedDate: Date | null; port: string | null; shipVia: string | null;
  patiscoOrderNo: string | null; note: string | null;
}

export default function PurchaseEditForm({ order, suppliers }: { order: Order; suppliers: Supplier[] }) {
  const router = useRouter()
  const toOrgPath = useOrgPath()
  const [form, setForm] = useState({
    supplierId: String(order.supplierId),
    currencyCode: order.currencyCode,
    exchangeRate: order.exchangeRate.toString(),
    expectedDate: order.expectedDate ? order.expectedDate.toISOString().split('T')[0] : '',
    port: order.port ?? '',
    shipVia: order.shipVia ?? '',
    patiscoOrderNo: order.patiscoOrderNo ?? '',
    note: order.note ?? '',
  })
  const [saving, setSaving] = useState(false)

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/purchases/${order.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      router.push(toOrgPath(`/purchases/${order.id}`))
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <section className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="Patisco 訂單號">
              <input type="text" value={form.patiscoOrderNo} onChange={e => set('patiscoOrderNo', e.target.value)} className={inp} />
            </Field>
          </div>
          <Field label="供應商" required>
            <select value={form.supplierId} onChange={e => set('supplierId', e.target.value)} className={inp} required>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.shortName ?? s.name}</option>)}
            </select>
          </Field>
          <Field label="幣別">
            <select value={form.currencyCode} onChange={e => set('currencyCode', e.target.value)} className={inp}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="匯率（對 TWD）">
            <input type="number" step="0.000001" value={form.exchangeRate} onChange={e => set('exchangeRate', e.target.value)} className={inp} />
          </Field>
          <Field label="預計到貨日">
            <input type="date" value={form.expectedDate} onChange={e => set('expectedDate', e.target.value)} className={inp} />
          </Field>
          <Field label="裝運港">
            <input type="text" value={form.port} onChange={e => set('port', e.target.value)} className={inp} />
          </Field>
          <Field label="運送方式">
            <select value={form.shipVia} onChange={e => set('shipVia', e.target.value)} className={inp}>
              <option value="">請選擇</option>
              {SHIP_VIA.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="備註">
              <textarea value={form.note} onChange={e => set('note', e.target.value)} className={`${inp} h-20`} />
            </Field>
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? '儲存中...' : '儲存'}
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
