'use client'
import { useState, useEffect, useRef } from 'react'

interface CustomField { label: string; value: string }

interface CompanyData {
  nameZh: string; nameEn: string; shortName: string
  addressZh: string; addressEn: string; city: string; countryCode: string
  phone: string; fax: string; email: string; website: string
  taxId: string; bankName: string; bankAccount: string; bankSwift: string
  customFields: CustomField[]
  logoBase64: string | null
}

const empty: CompanyData = {
  nameZh: '', nameEn: '', shortName: '',
  addressZh: '', addressEn: '', city: '', countryCode: 'TW',
  phone: '', fax: '', email: '', website: '',
  taxId: '', bankName: '', bankAccount: '', bankSwift: '',
  customFields: [], logoBase64: null,
}

export default function CompanyForm() {
  const [data, setData] = useState<CompanyData>(empty)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const logoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/settings/company')
      .then(r => r.json())
      .then((d: CompanyData) => setData({ ...empty, ...d }))
  }, [])

  function set(field: keyof CompanyData, value: string) {
    setData(prev => ({ ...prev, [field]: value }))
  }

  function setCustomField(idx: number, key: 'label' | 'value', val: string) {
    setData(prev => ({
      ...prev,
      customFields: prev.customFields.map((f, i) => i === idx ? { ...f, [key]: val } : f),
    }))
  }

  function addCustomField() {
    setData(prev => ({ ...prev, customFields: [...prev.customFields, { label: '', value: '' }] }))
  }

  function removeCustomField(idx: number) {
    setData(prev => ({ ...prev, customFields: prev.customFields.filter((_, i) => i !== idx) }))
  }

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setData(prev => ({ ...prev, logoBase64: ev.target?.result as string }))
    reader.readAsDataURL(file)
  }

  async function save() {
    setSaving(true)
    setMsg(null)
    const res = await fetch('/api/settings/company', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setSaving(false)
    setMsg(res.ok ? { type: 'ok', text: '已儲存' } : { type: 'err', text: '儲存失敗，請再試' })
  }

  return (
    <div className="space-y-8 max-w-2xl">

      {/* Logo */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">公司 Logo</h2>
        <div className="flex items-center gap-4">
          {data.logoBase64
            ? <img src={data.logoBase64} alt="Logo" className="h-16 object-contain border rounded p-1" />
            : <div className="h-16 w-32 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-xs text-gray-400">未上傳</div>
          }
          <div className="space-y-1">
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
            <button type="button" onClick={() => logoRef.current?.click()}
              className="text-sm border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50">
              {data.logoBase64 ? '更換 Logo' : '上傳 Logo'}
            </button>
            {data.logoBase64 && (
              <button type="button" onClick={() => setData(prev => ({ ...prev, logoBase64: null }))}
                className="block text-xs text-red-500 hover:underline">移除</button>
            )}
            <p className="text-xs text-gray-400">建議 PNG，寬度 400px 以上</p>
          </div>
        </div>
      </section>

      {/* 公司名稱 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">公司名稱</h2>
        <div className="grid grid-cols-1 gap-3">
          <Field label="中文名稱">
            <input value={data.nameZh} onChange={e => set('nameZh', e.target.value)} className={inp} placeholder="錫諾系統有限公司" />
          </Field>
          <Field label="英文名稱">
            <input value={data.nameEn} onChange={e => set('nameEn', e.target.value)} className={inp} placeholder="Xinosys Co., Ltd." />
          </Field>
          <Field label="簡稱（文件抬頭用）">
            <input value={data.shortName} onChange={e => set('shortName', e.target.value)} className={inp} placeholder="XINOSYS" />
          </Field>
        </div>
      </section>

      {/* 地址 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">地址</h2>
        <div className="grid grid-cols-1 gap-3">
          <Field label="中文地址">
            <input value={data.addressZh} onChange={e => set('addressZh', e.target.value)} className={inp} />
          </Field>
          <Field label="英文地址">
            <input value={data.addressEn} onChange={e => set('addressEn', e.target.value)} className={inp} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="城市">
              <input value={data.city} onChange={e => set('city', e.target.value)} className={inp} placeholder="Taipei" />
            </Field>
            <Field label="國家代碼">
              <input value={data.countryCode} onChange={e => set('countryCode', e.target.value)} className={inp} placeholder="TW" maxLength={2} />
            </Field>
          </div>
        </div>
      </section>

      {/* 聯絡資訊 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">聯絡資訊</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="電話"><input value={data.phone} onChange={e => set('phone', e.target.value)} className={inp} /></Field>
          <Field label="傳真"><input value={data.fax} onChange={e => set('fax', e.target.value)} className={inp} /></Field>
          <Field label="Email"><input type="email" value={data.email} onChange={e => set('email', e.target.value)} className={inp} /></Field>
          <Field label="網站"><input value={data.website} onChange={e => set('website', e.target.value)} className={inp} placeholder="https://" /></Field>
        </div>
      </section>

      {/* 貿易資訊 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">貿易 / 金融資訊</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="統一編號 / VAT"><input value={data.taxId} onChange={e => set('taxId', e.target.value)} className={inp} /></Field>
          <Field label="銀行名稱"><input value={data.bankName} onChange={e => set('bankName', e.target.value)} className={inp} /></Field>
          <Field label="帳號"><input value={data.bankAccount} onChange={e => set('bankAccount', e.target.value)} className={inp} /></Field>
          <Field label="SWIFT Code"><input value={data.bankSwift} onChange={e => set('bankSwift', e.target.value)} className={inp} placeholder="XXXXTWTP" /></Field>
        </div>
      </section>

      {/* 自訂欄位 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">自訂欄位</h2>
          <button type="button" onClick={addCustomField}
            className="text-xs text-blue-600 hover:underline">+ 新增</button>
        </div>
        {data.customFields.length === 0 && (
          <p className="text-xs text-gray-400">可新增其他欄位，例如：DUNS、進口商編號、授權書號等</p>
        )}
        <div className="space-y-2">
          {data.customFields.map((f, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input value={f.label} onChange={e => setCustomField(i, 'label', e.target.value)}
                className={`${inp} w-32`} placeholder="欄位名稱" />
              <input value={f.value} onChange={e => setCustomField(i, 'value', e.target.value)}
                className={`${inp} flex-1`} placeholder="內容" />
              <button type="button" onClick={() => removeCustomField(i)}
                className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
            </div>
          ))}
        </div>
      </section>

      {msg && (
        <p className={`text-sm ${msg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>
      )}

      <button onClick={save} disabled={saving}
        className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
        {saving ? '儲存中…' : '儲存'}
      </button>
    </div>
  )
}

const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
