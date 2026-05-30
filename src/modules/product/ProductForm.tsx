'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProductFormData, emptyProductForm, validateProduct } from './productSchema'

type Props = {
  initialData?: Partial<ProductFormData>
  productId?: string
}

const UNITS = ['PCS', 'SET', 'KGS', 'DZ', 'PR', 'EA']
const COUNTRIES = [
  { code: 'CN', name: '中國' },
  { code: 'TW', name: '台灣' },
  { code: 'VN', name: '越南' },
  { code: 'IN', name: '印度' },
  { code: 'BD', name: '孟加拉' },
  { code: 'TH', name: '泰國' },
  { code: 'ID', name: '印尼' },
]

export default function ProductForm({ initialData, productId }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<ProductFormData>({ ...emptyProductForm, ...initialData })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function set(field: keyof ProductFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validateProduct(form)
    if (validationError) { setError(validationError); return }

    setSaving(true)
    setError('')

    const url = productId ? `/api/products/${productId}` : '/api/products'
    const method = productId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setSaving(false)
    if (!res.ok) {
      setError('儲存失敗，請再試一次')
      return
    }

    const data = await res.json()
    router.push(`/products/${data.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* 基本資料 */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">基本資料</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="商品名稱" required>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                className={input}
                placeholder="商品完整名稱"
              />
            </Field>
          </div>
          <Field label="SKU / 料號">
            <input type="text" value={form.sku} onChange={e => set('sku', e.target.value)} className={input} />
          </Field>
          <Field label="型號 Model No.">
            <input type="text" value={form.modelNo} onChange={e => set('modelNo', e.target.value)} className={input} />
          </Field>
          <Field label="單位">
            <select value={form.unit} onChange={e => set('unit', e.target.value)} className={input}>
              <option value="">請選擇</option>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="原產地">
            <select value={form.countryOfOrigin} onChange={e => set('countryOfOrigin', e.target.value)} className={input}>
              <option value="">請選擇</option>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="商品描述">
              <textarea value={form.description} onChange={e => set('description', e.target.value)} className={`${input} h-20`} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="規格說明">
              <textarea value={form.specification} onChange={e => set('specification', e.target.value)} className={`${input} h-20`} />
            </Field>
          </div>
        </div>
      </section>

      {/* 包裝規格 */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">包裝規格</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="每內箱數量">
            <input type="number" value={form.unitPerInner} onChange={e => set('unitPerInner', e.target.value)} className={input} min="0" />
          </Field>
          <Field label="每外箱數量">
            <input type="number" value={form.unitPerCarton} onChange={e => set('unitPerCarton', e.target.value)} className={input} min="0" />
          </Field>
          <Field label="CBM (材積)">
            <input type="number" value={form.cbm} onChange={e => set('cbm', e.target.value)} className={input} step="0.0001" min="0" />
          </Field>
          <Field label="毛重 (KGS)">
            <input type="number" value={form.grossWeight} onChange={e => set('grossWeight', e.target.value)} className={input} step="0.001" min="0" />
          </Field>
          <Field label="淨重 (KGS)">
            <input type="number" value={form.netWeight} onChange={e => set('netWeight', e.target.value)} className={input} step="0.001" min="0" />
          </Field>
          <Field label="長 (CM)">
            <input type="number" value={form.length} onChange={e => set('length', e.target.value)} className={input} step="0.01" min="0" />
          </Field>
          <Field label="寬 (CM)">
            <input type="number" value={form.width} onChange={e => set('width', e.target.value)} className={input} step="0.01" min="0" />
          </Field>
          <Field label="高 (CM)">
            <input type="number" value={form.height} onChange={e => set('height', e.target.value)} className={input} step="0.01" min="0" />
          </Field>
        </div>
      </section>

      {/* 貿易資訊 */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">貿易資訊</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="HTS Code (海關編碼)">
            <input type="text" value={form.htsCode} onChange={e => set('htsCode', e.target.value)} className={input} placeholder="e.g. 9503.00.0073" />
          </Field>
        </div>
      </section>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? '儲存中...' : '儲存'}
        </button>
        <button type="button" onClick={() => router.back()} className="border border-gray-300 text-gray-700 px-6 py-2 rounded-md text-sm hover:bg-gray-50">
          取消
        </button>
      </div>
    </form>
  )
}

const input = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

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
