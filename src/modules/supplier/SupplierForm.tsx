'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export type SupplierFormData = {
  name: string
  shortName: string
  address: string
  city: string
  countryCode: string
  postalCode: string
  phoneNo: string
  fax: string
  email: string
  contactPerson: string
  taxId: string
  paymentTerms: string
  currencyCode: string
  defaultTradeTerms: string
  note: string
  chargeTemplateId: string  // '' = 不套用
}

const empty: SupplierFormData = {
  name: '', shortName: '', address: '', city: '', countryCode: '',
  postalCode: '', phoneNo: '', fax: '', email: '', contactPerson: '',
  taxId: '', paymentTerms: '', currencyCode: '', defaultTradeTerms: '', note: '',
  chargeTemplateId: '',
}

const COUNTRIES = [
  { code: 'CN', name: '中國' }, { code: 'TW', name: '台灣' },
  { code: 'VN', name: '越南' }, { code: 'IN', name: '印度' },
  { code: 'BD', name: '孟加拉' }, { code: 'TH', name: '泰國' },
  { code: 'ID', name: '印尼' }, { code: 'PK', name: '巴基斯坦' },
  { code: 'MY', name: '馬來西亞' }, { code: 'US', name: '美國' },
]

const CURRENCIES = ['USD', 'CNY', 'TWD', 'EUR', 'JPY', 'HKD']

const TRADE_TERMS = [
  { value: 'FOB', label: 'FOB — 船上交貨（供應商自理到港口）' },
  { value: 'FOR', label: 'FOR — 鐵路交貨（我方負擔運費到港口）' },
  { value: 'EXW', label: 'EXW — 出廠交貨' },
  { value: 'CIF', label: 'CIF — 含保險費在內的到岸價' },
  { value: 'CFR', label: 'CFR — 含運費的目的港價' },
  { value: 'FCA', label: 'FCA — 貨交承運人' },
  { value: 'DDP', label: 'DDP — 完稅後交貨' },
]

const PAYMENT_TERMS = [
  'T/T 30 days', 'T/T 60 days', 'L/C at sight', 'L/C 30 days',
  'D/P', 'D/A 30 days', '100% advance',
]

type Props = {
  initialData?: Partial<SupplierFormData>
  supplierId?: string
}

export default function SupplierForm({ initialData, supplierId }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<SupplierFormData>({ ...empty, ...initialData })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [chargeTemplates, setChargeTemplates] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    fetch('/api/charge-templates').then(r => r.json()).then((list: { id: number; name: string }[]) => setChargeTemplates(list))
  }, [])

  function set(field: keyof SupplierFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('供應商名稱為必填'); return }

    setSaving(true)
    setError('')

    const url = supplierId ? `/api/suppliers/${supplierId}` : '/api/suppliers'
    const method = supplierId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setSaving(false)
    if (!res.ok) { setError('儲存失敗，請再試一次'); return }

    const data = await res.json()
    router.push(`/suppliers/${data.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* 基本資料 */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">基本資料</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="供應商名稱" required>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                className={inp} placeholder="公司全名" />
            </Field>
          </div>
          <Field label="簡稱">
            <input type="text" value={form.shortName} onChange={e => set('shortName', e.target.value)} className={inp} />
          </Field>
          <Field label="慣用幣別">
            <select value={form.currencyCode} onChange={e => set('currencyCode', e.target.value)} className={inp}>
              <option value="">請選擇</option>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="付款條件">
            <select value={form.paymentTerms} onChange={e => set('paymentTerms', e.target.value)} className={inp}>
              <option value="">請選擇</option>
              {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="報價原則（Incoterms）">
            <select value={form.defaultTradeTerms} onChange={e => set('defaultTradeTerms', e.target.value)} className={inp}>
              <option value="">未設定</option>
              {TRADE_TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="統一編號 / Tax ID">
            <input type="text" value={form.taxId} onChange={e => set('taxId', e.target.value)} className={inp} />
          </Field>
        </div>
      </section>

      {/* 聯絡資訊 */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">聯絡資訊</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="主要聯絡人">
            <input type="text" value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} className={inp} />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inp} />
          </Field>
          <Field label="電話">
            <input type="text" value={form.phoneNo} onChange={e => set('phoneNo', e.target.value)} className={inp} />
          </Field>
          <Field label="傳真">
            <input type="text" value={form.fax} onChange={e => set('fax', e.target.value)} className={inp} />
          </Field>
        </div>
      </section>

      {/* 地址 */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">地址</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="地址">
              <input type="text" value={form.address} onChange={e => set('address', e.target.value)} className={inp} />
            </Field>
          </div>
          <Field label="城市">
            <input type="text" value={form.city} onChange={e => set('city', e.target.value)} className={inp} />
          </Field>
          <Field label="國家">
            <select value={form.countryCode} onChange={e => set('countryCode', e.target.value)} className={inp}>
              <option value="">請選擇</option>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
            </select>
          </Field>
          <Field label="郵遞區號">
            <input type="text" value={form.postalCode} onChange={e => set('postalCode', e.target.value)} className={inp} />
          </Field>
        </div>
      </section>

      {/* 列印費用模板 */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-3">列印費用模板</h2>
        <p className="text-xs text-gray-400 mb-3">列印 PO 時自動帶入此費用模板的附加費用計算。可至「設定 → 費用模板」管理。</p>
        <Field label="費用模板">
          <select value={form.chargeTemplateId} onChange={e => set('chargeTemplateId', e.target.value)} className={inp}>
            <option value="">不套用</option>
            {chargeTemplates.map(t => (
              <option key={t.id} value={String(t.id)}>{t.name}</option>
            ))}
          </select>
        </Field>
      </section>

      {/* 備註 */}
      <section className="bg-white rounded-lg shadow p-6">
        <Field label="備註">
          <textarea value={form.note} onChange={e => set('note', e.target.value)} className={`${inp} h-24`} />
        </Field>
      </section>

      {error && <p className="text-red-500 text-sm">{error}</p>}

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
