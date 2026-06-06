'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type CustomerFormData = {
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
  patiscoBuyerId: string
  note: string
}

const empty: CustomerFormData = {
  name: '', shortName: '', address: '', city: '', countryCode: '',
  postalCode: '', phoneNo: '', fax: '', email: '', contactPerson: '',
  taxId: '', paymentTerms: '', currencyCode: '', patiscoBuyerId: '', note: '',
}

const COUNTRIES = [
  { code: 'US', name: '美國' }, { code: 'GB', name: '英國' },
  { code: 'DE', name: '德國' }, { code: 'FR', name: '法國' },
  { code: 'IT', name: '義大利' }, { code: 'ES', name: '西班牙' },
  { code: 'AU', name: '澳大利亞' }, { code: 'CA', name: '加拿大' },
  { code: 'JP', name: '日本' }, { code: 'KR', name: '韓國' },
  { code: 'TW', name: '台灣' }, { code: 'HK', name: '香港' },
  { code: 'SG', name: '新加坡' }, { code: 'NL', name: '荷蘭' },
  { code: 'BE', name: '比利時' }, { code: 'SE', name: '瑞典' },
  { code: 'MX', name: '墨西哥' }, { code: 'BR', name: '巴西' },
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'TWD', 'HKD', 'SGD']

const PAYMENT_TERMS = [
  'T/T 30 days', 'T/T 60 days', 'T/T 90 days',
  'L/C at sight', 'L/C 30 days', 'L/C 60 days',
  'D/P', 'D/A 30 days', '100% advance',
]

type Props = {
  initialData?: Partial<CustomerFormData>
  customerId?: string
}

export default function CustomerForm({ initialData, customerId }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<CustomerFormData>({ ...empty, ...initialData })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function set(field: keyof CustomerFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('客戶名稱為必填'); return }

    setSaving(true)
    setError('')

    const url = customerId ? `/api/customers/${customerId}` : '/api/customers'
    const method = customerId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setSaving(false)
    if (!res.ok) { setError('儲存失敗，請再試一次'); return }

    const data = await res.json()
    router.push(`/customers/${data.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">基本資料</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="客戶名稱" required>
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
          <Field label="統一編號 / Tax ID">
            <input type="text" value={form.taxId} onChange={e => set('taxId', e.target.value)} className={inp} />
          </Field>
          <Field label="Patisco Buyer ID">
            <input type="number" value={form.patiscoBuyerId} onChange={e => set('patiscoBuyerId', e.target.value)}
              className={inp} placeholder="留空表示未關聯" />
          </Field>
        </div>
      </section>

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
