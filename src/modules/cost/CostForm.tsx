'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Product = {
  id: number; name: string; sku: string | null; modelNo: string | null; unit: string | null
  unitPerInner: number | null; unitPerCarton: number | null
  cbm: { toString(): string } | string | null
  grossWeight: { toString(): string } | string | null
  netWeight: { toString(): string } | string | null
  htsCode: string | null; countryOfOrigin: string | null
}

type FormData = {
  name: string; productId: string
  fobPrice: string; fobCurrency: string; fobExRate: string
  countryOfOrigin: string; portOfLoading: string
  htsCode: string; dutyRate: string
  oceanFreight: string; insurance: string; agentFee: string
  consolidation: string; deconsolidation: string
  userFee: string; harborFee: string; otherCharge: string; otherChargeNote: string
  sellingPrice: string
  container40ftQty: string; container40ftPcs: string
}

const empty: FormData = {
  name: '', productId: '',
  fobPrice: '', fobCurrency: 'USD', fobExRate: '1',
  countryOfOrigin: '', portOfLoading: '',
  htsCode: '', dutyRate: '',
  oceanFreight: '', insurance: '', agentFee: '',
  consolidation: '', deconsolidation: '',
  userFee: '', harborFee: '', otherCharge: '', otherChargeNote: '',
  sellingPrice: '',
  container40ftQty: '', container40ftPcs: '',
}

const CURRENCIES = ['USD', 'CNY', 'TWD', 'EUR', 'JPY', 'HKD']

type Props = {
  products: Product[]
  initialData?: Partial<FormData>
  sheetId?: string
}

// 計算引擎（純函式，無副作用）
function calcLandedCost(f: FormData) {
  const fobUsd = (parseFloat(f.fobPrice) || 0) * (parseFloat(f.fobExRate) || 1)
  const duty = f.dutyRate
    ? fobUsd * (parseFloat(f.dutyRate) || 0)
    : 0
  const landed = fobUsd + duty
    + (parseFloat(f.oceanFreight) || 0)
    + (parseFloat(f.insurance) || 0)
    + (parseFloat(f.agentFee) || 0)
    + (parseFloat(f.consolidation) || 0)
    + (parseFloat(f.deconsolidation) || 0)
    + (parseFloat(f.userFee) || 0)
    + (parseFloat(f.harborFee) || 0)
    + (parseFloat(f.otherCharge) || 0)
  const selling = parseFloat(f.sellingPrice) || 0
  const grossPct = selling > 0 ? ((selling - landed) / selling * 100) : null
  return { fobUsd, duty, landed, selling, grossPct }
}

export default function CostForm({ products, initialData, sheetId }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormData>({ ...empty, ...initialData })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const calc = calcLandedCost(form)

  function set(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // 選擇商品時自動帶入欄位
  const onProductChange = useCallback((productId: string) => {
    const p = products.find(p => String(p.id) === productId)
    if (!p) { set('productId', productId); return }
    setForm(prev => ({
      ...prev,
      productId,
      name: prev.name || p.name,
      htsCode: prev.htsCode || p.htsCode || '',
      countryOfOrigin: prev.countryOfOrigin || p.countryOfOrigin || '',
      container40ftPcs: prev.container40ftPcs || (p.unitPerCarton ? String(p.unitPerCarton) : ''),
    }))
  }, [products])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.productId || !form.fobPrice) { setError('請選擇商品並輸入 FOB 價格'); return }
    if (!form.name) { setError('請填寫試算表名稱'); return }

    setSaving(true); setError('')

    const url = sheetId ? `/api/cost/${sheetId}` : '/api/cost'
    const method = sheetId ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) { setError('儲存失敗，請再試一次'); return }
    const data = await res.json()
    router.push(`/cost/${data.id}`)
    router.refresh()
  }

  const p = (v: number, d = 4) => v.toFixed(d)
  const fmtUsd = (v: number) => `USD ${v.toFixed(2)}`
  const pct = (v: number | null) =>
    v === null ? '-' : `${v >= 0 ? '' : ''}${v.toFixed(1)}%`
  const grossColor = calc.grossPct === null ? 'text-gray-400'
    : calc.grossPct < 0 ? 'text-red-600'
    : calc.grossPct < 20 ? 'text-yellow-600'
    : 'text-green-600'

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">

      {/* 基本資料 */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">試算基本資料</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="試算表名稱" required>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                className={inp} placeholder="例：Toy Car 2024 Q1 Cost Sheet" />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="商品" required>
              <select value={form.productId} onChange={e => onProductChange(e.target.value)} className={inp} required>
                <option value="">請選擇商品</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.sku ? ` (${p.sku})` : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </section>

      {/* FOB 成本 */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-1">FOB 成本</h2>
        <p className="text-xs text-gray-400 mb-4">供應商報價，為成本計算的起點</p>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Field label="FOB 單價" required>
              <input type="number" step="0.0001" min="0" value={form.fobPrice}
                onChange={e => set('fobPrice', e.target.value)} className={inp} placeholder="0.0000" />
            </Field>
          </div>
          <Field label="幣別">
            <select value={form.fobCurrency} onChange={e => set('fobCurrency', e.target.value)} className={inp}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <div className="col-span-2">
            <Field label={`對 USD 匯率（1 ${form.fobCurrency} = ? USD）`}>
              <input type="number" step="0.000001" min="0" value={form.fobExRate}
                onChange={e => set('fobExRate', e.target.value)} className={inp} />
            </Field>
          </div>
          <div className="flex items-end pb-0.5">
            <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-sm w-full text-right">
              <span className="text-xs text-blue-400 block">= FOB (USD)</span>
              <span className="font-semibold text-blue-700">{fmtUsd(calc.fobUsd)}</span>
            </div>
          </div>
          <Field label="裝運港">
            <input type="text" value={form.portOfLoading} onChange={e => set('portOfLoading', e.target.value)}
              className={inp} placeholder="YANTIAN, SHANGHAI..." />
          </Field>
          <Field label="原產地">
            <input type="text" value={form.countryOfOrigin} onChange={e => set('countryOfOrigin', e.target.value)}
              className={inp} placeholder="CN, VN, TW..." />
          </Field>
        </div>
      </section>

      {/* 進口端費用 */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-1">進口端費用（USD / 件）</h2>
        <p className="text-xs text-gray-400 mb-4">所有費用請換算為每件（per piece）的 USD 金額</p>

        {/* 關稅 */}
        <div className="border-b border-gray-100 pb-4 mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">關稅</p>
          <div className="grid grid-cols-3 gap-4">
            <Field label="HTS Code">
              <input type="text" value={form.htsCode} onChange={e => set('htsCode', e.target.value)}
                className={inp} placeholder="9503.00.0073" />
            </Field>
            <Field label="關稅率 (%)">
              <div className="relative">
                <input type="number" step="0.0001" min="0" max="1" value={form.dutyRate}
                  onChange={e => set('dutyRate', e.target.value)}
                  className={inp} placeholder="0.0000" />
                <span className="absolute right-3 top-2.5 text-xs text-gray-400">× FOB</span>
              </div>
            </Field>
            <div className="flex items-end pb-0.5">
              <div className="bg-orange-50 border border-orange-200 rounded-md px-3 py-2 text-sm w-full text-right">
                <span className="text-xs text-orange-400 block">= 關稅額</span>
                <span className="font-semibold text-orange-700">{fmtUsd(calc.duty)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 其他費用 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { key: 'oceanFreight', label: '海運費' },
            { key: 'insurance', label: '保險費' },
            { key: 'agentFee', label: '報關代理費' },
            { key: 'consolidation', label: '併櫃費' },
            { key: 'deconsolidation', label: '拆櫃費' },
            { key: 'userFee', label: 'User Fee（MPF）' },
            { key: 'harborFee', label: 'Harbor Fee（HMF）' },
          ].map(({ key, label }) => (
            <Field key={key} label={label}>
              <input type="number" step="0.00001" min="0"
                value={form[key as keyof FormData] as string}
                onChange={e => set(key as keyof FormData, e.target.value)}
                className={inp} placeholder="0.00000" />
            </Field>
          ))}
          <div className="md:col-span-2">
            <Field label="其他雜費">
              <div className="flex gap-2">
                <input type="number" step="0.00001" min="0" value={form.otherCharge}
                  onChange={e => set('otherCharge', e.target.value)} className={`${inp} w-32`} placeholder="0.00000" />
                <input type="text" value={form.otherChargeNote} onChange={e => set('otherChargeNote', e.target.value)}
                  className={inp} placeholder="說明..." />
              </div>
            </Field>
          </div>
        </div>
      </section>

      {/* 即時計算結果 */}
      <section className="bg-gray-900 rounded-lg shadow p-6 text-white">
        <h2 className="text-base font-semibold mb-4 text-gray-100">到岸成本計算</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <CostItem label="FOB (USD)" value={fmtUsd(calc.fobUsd)} sub="供應商報價" />
          <CostItem label="+ 關稅" value={fmtUsd(calc.duty)} sub={form.dutyRate ? `${(parseFloat(form.dutyRate)||0)*100}%` : '未設定'} />
          <CostItem label="+ 其他費用" value={fmtUsd(calc.landed - calc.fobUsd - calc.duty)} sub="運費+保險+代理…" />
          <CostItem label="= Landed Cost" value={fmtUsd(calc.landed)} sub="到岸總成本" highlight />
        </div>

        {/* 售價與毛利 */}
        <div className="border-t border-gray-700 pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="建議售價 (USD)">
              <input type="number" step="0.01" min="0" value={form.sellingPrice}
                onChange={e => set('sellingPrice', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00" />
            </Field>
            <div className="flex flex-col justify-end">
              <p className="text-xs text-gray-400 mb-1">毛利率（Gross %）</p>
              <p className={`text-3xl font-bold ${grossColor}`}>{pct(calc.grossPct)}</p>
              {calc.grossPct !== null && calc.landed > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  每件毛利 {fmtUsd(calc.selling - calc.landed)}
                </p>
              )}
            </div>
            <div className="flex flex-col justify-end">
              {calc.grossPct !== null && (
                <div className={`text-xs px-3 py-2 rounded-md ${
                  calc.grossPct < 0 ? 'bg-red-900 text-red-200' :
                  calc.grossPct < 20 ? 'bg-yellow-900 text-yellow-200' :
                  'bg-green-900 text-green-200'
                }`}>
                  {calc.grossPct < 0 ? '⚠ 低於成本，虧損' :
                   calc.grossPct < 20 ? '⚠ 毛利率偏低（< 20%）' :
                   '✓ 毛利率健康'}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 容器資訊 */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">40呎貨櫃裝載量</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="箱數（Cartons）">
            <input type="number" min="0" value={form.container40ftQty}
              onChange={e => set('container40ftQty', e.target.value)} className={inp} />
          </Field>
          <Field label="件數（Pieces）">
            <input type="number" min="0" value={form.container40ftPcs}
              onChange={e => set('container40ftPcs', e.target.value)} className={inp} />
          </Field>
        </div>
      </section>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? '儲存中...' : '儲存試算表'}
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
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

function CostItem({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md p-3 ${highlight ? 'bg-blue-600' : 'bg-gray-800'}`}>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  )
}
