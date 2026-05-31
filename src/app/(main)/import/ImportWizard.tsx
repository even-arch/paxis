'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SHIP_VIA, CURRENCIES } from '@/modules/purchase/poUtils'
import type { ParsedInvoice } from '@/app/api/ai/parse-invoice/route'
import type { ImportPurchaseInput } from '@/app/api/purchases/import/route'

type DbSupplier = { id: number; name: string; shortName: string | null; currencyCode: string | null; email: string | null; phoneNo: string | null; address: string | null; city: string | null; countryCode: string | null; paymentTerms: string | null }
type DbProduct  = { id: number; name: string; sku: string | null; unit: string | null; specification: string | null }

// 產品確認 state
type ProductDraft = {
  name: string; specification: string; sku: string
  qty: string; unitPrice: string; unit: string
  // 衝突偵測
  conflictId: number | null; conflictName: string; conflictSpec: string; hasDiff: boolean
  action: 'create' | 'use-existing'
}

// 供應商確認 state
type SupplierDraft = {
  name: string; shortName: string; email: string; phone: string
  address: string; city: string; country: string
  contactPerson: string; paymentTerms: string; currencyCode: string
  action: 'use-existing' | 'create'
  matchedId: number | null; matchedSupplier: DbSupplier | null
}

type Mode = 'upload' | 'products' | 'supplier' | 'po'

export default function ImportWizard({ suppliers, products }: { suppliers: DbSupplier[]; products: DbProduct[] }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('upload')

  const [productDrafts,  setProductDrafts]  = useState<ProductDraft[]>([])
  const [supplierDraft,  setSupplierDraft]  = useState<SupplierDraft>({
    name: '', shortName: '', email: '', phone: '', address: '', city: '', country: '',
    contactPerson: '', paymentTerms: '', currencyCode: 'USD',
    action: 'create', matchedId: null, matchedSupplier: null,
  })

  // PO 欄位
  const [sourceType,   setSourceType]   = useState('0')
  const [docRefNo,     setDocRefNo]     = useState('')
  const [currencyCode, setCurrencyCode] = useState('USD')
  const [exchangeRate, setExchangeRate] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [port,         setPort]         = useState('')
  const [shipVia,      setShipVia]      = useState('')
  const [note,         setNote]         = useState('')

  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [parseMsg, setParseMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const stepLabels = ['上傳單據', '確認產品', '確認供應商', '確認採購單']
  const stepIndex  = { upload: 0, products: 1, supplier: 2, po: 3 }[mode]

  // ─── 上傳 & 解析（唯一的 AI 呼叫）────────────────────────────────────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true); setParseMsg(''); setError('')
    e.target.value = ''
    try {
      const fd = new FormData(); fd.append('file', file)
      const res  = await fetch('/api/ai/parse-invoice', { method: 'POST', body: fd })
      const json = await res.json() as { data?: ParsedInvoice; error?: string }
      if (!res.ok) throw new Error(json.error ?? `解析失敗 (HTTP ${res.status})`)

      const inv = json.data!

      // 本地 SKU 衝突偵測
      const drafts: ProductDraft[] = (inv.items ?? []).map(it => {
        const sku = it.sku?.trim() ?? ''
        const ex  = sku ? products.find(p => p.sku?.toLowerCase() === sku.toLowerCase()) : undefined
        const hasDiff = ex
          ? ex.name.toLowerCase() !== (it.name?.trim().toLowerCase() ?? '') ||
            (ex.specification ?? '') !== (it.specification?.trim() ?? '')
          : false
        return {
          name: it.name?.trim() ?? '', specification: it.specification?.trim() ?? '', sku,
          qty: String(it.qty ?? 1), unitPrice: String(it.unitPrice ?? 0), unit: it.unit?.trim() ?? 'PCS',
          conflictId: ex?.id ?? null, conflictName: ex?.name ?? '', conflictSpec: ex?.specification ?? '',
          hasDiff, action: ex ? 'use-existing' : 'create',
        }
      })
      setProductDrafts(drafts)

      // 本地供應商比對
      const supName = inv.supplierName?.trim() ?? ''
      const matched = supName
        ? suppliers.find(s =>
            s.name.toLowerCase() === supName.toLowerCase() ||
            supName.toLowerCase().includes(s.name.toLowerCase()) ||
            s.name.toLowerCase().includes(supName.toLowerCase()) ||
            (s.shortName?.toLowerCase() === supName.toLowerCase()))
        : undefined

      setSupplierDraft({
        name: supName, shortName: '', email: inv.supplierEmail?.trim() ?? '',
        phone: inv.supplierPhone?.trim() ?? '', address: inv.supplierAddress?.trim() ?? '',
        city: inv.supplierCity?.trim() ?? '', country: inv.supplierCountry?.trim() ?? '',
        contactPerson: '', paymentTerms: '', currencyCode: inv.currency ?? 'USD',
        action: matched ? 'use-existing' : 'create',
        matchedId: matched?.id ?? null, matchedSupplier: matched ?? null,
      })

      if (inv.invoiceNo) setDocRefNo(inv.invoiceNo)
      if (inv.currency)  setCurrencyCode(inv.currency)

      setParseMsg(`解析完成，共 ${drafts.length} 項產品。`)
      setMode('products')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  // ─── 最終送出（一次性寫入所有資料）──────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierDraft.name.trim()) { setError('供應商名稱不能為空'); return }
    if (!productDrafts.length) { setError('至少需要一項產品'); return }

    setSaving(true); setError('')
    try {
      const payload: ImportPurchaseInput = {
        items: productDrafts.map(d => ({
          name:          d.action === 'use-existing' ? d.conflictName || d.name : d.name,
          specification: d.specification || null,
          sku:           d.sku || null,
          qty:           Number(d.qty),
          unitPrice:     Number(d.unitPrice),
          unit:          d.unit,
          action:        d.action,
          existingId:    d.action === 'use-existing' ? d.conflictId : null,
        })),
        supplier: {
          action:        supplierDraft.action,
          existingId:    supplierDraft.matchedId,
          name:          supplierDraft.name,
          shortName:     supplierDraft.shortName || null,
          email:         supplierDraft.email || null,
          phone:         supplierDraft.phone || null,
          address:       supplierDraft.address || null,
          city:          supplierDraft.city || null,
          country:       supplierDraft.country || null,
          contactPerson: supplierDraft.contactPerson || null,
          paymentTerms:  supplierDraft.paymentTerms || null,
          currencyCode:  supplierDraft.currencyCode || null,
        },
        po: {
          sourceType: Number(sourceType), docRefNo, currencyCode,
          exchangeRate: exchangeRate || '1', expectedDate, port, shipVia, note,
        },
      }

      const res  = await fetch('/api/purchases/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json() as { ok?: boolean; orderId?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? `寫入失敗 (HTTP ${res.status})`)
      router.push(`/purchases/${json.orderId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  // ─── 共用 UI ─────────────────────────────────────────────────────────────────
  const StepBar = () => (
    <div className="flex items-center gap-0 mb-6">
      {stepLabels.map((s, i) => (
        <div key={i} className="flex items-center">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${i < stepIndex ? 'text-green-600' : i === stepIndex ? 'text-blue-600' : 'text-gray-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs border ${i < stepIndex ? 'bg-green-100 border-green-400 text-green-700' : i === stepIndex ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-gray-100 border-gray-300 text-gray-400'}`}>
              {i < stepIndex ? '✓' : i + 1}
            </span>
            {s}
          </div>
          {i < stepLabels.length - 1 && <div className={`mx-2 h-px w-8 ${i < stepIndex ? 'bg-green-300' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )

  const ErrorBar = () => !error ? null : (
    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
      {error}
      <button onClick={() => setError('')} className="ml-2 underline text-xs">關閉</button>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════════
  // 步驟 0：上傳
  // ══════════════════════════════════════════════════════════════════════════════
  if (mode === 'upload') {
    return (
      <div className="max-w-2xl">
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.txt" className="hidden" onChange={handleFile} />
        <ErrorBar />
        {loading ? (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3 animate-pulse">⏳</div>
            <p className="text-purple-700 font-medium">AI 解析中，請稍候…</p>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-full flex flex-col items-center gap-4 bg-white border-2 border-dashed border-purple-300 rounded-xl p-12 hover:border-purple-500 hover:bg-purple-50 transition-all text-center">
            <span className="text-5xl">📄</span>
            <div>
              <p className="font-semibold text-gray-800 text-lg">點擊上傳採購單或形式發票（PI）</p>
              <p className="text-sm text-gray-500 mt-1">支援 PDF、Excel、圖片（JPG / PNG）</p>
              <p className="text-xs text-purple-600 mt-3">AI 自動識別供應商、料號、數量、單價，建立完成後直接產出採購單</p>
            </div>
          </button>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 步驟 1：確認產品（只是 review，不寫 DB）
  // ══════════════════════════════════════════════════════════════════════════════
  if (mode === 'products') {
    return (
      <div className="max-w-5xl space-y-4">
        <StepBar />
        {parseMsg && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700">{parseMsg}</div>}
        <ErrorBar />

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">步驟 1：確認產品資料</h2>
            <p className="text-xs text-gray-500 mt-0.5">確認資料正確後繼續，產品將在最後一步一起寫入。<span className="text-amber-600">⚠ 黃底 = 料號已存在但資料有差異</span></p>
          </div>

          <div className="divide-y divide-gray-50">
            {productDrafts.map((item, idx) => {
              const isConflict = item.conflictId !== null && item.hasDiff
              const isMatched  = item.conflictId !== null && !item.hasDiff
              return (
                <div key={idx} className={`px-6 py-4 ${isConflict ? 'bg-amber-50' : ''}`}>
                  {isConflict && (
                    <div className="mb-3 flex items-start gap-3">
                      <div className="flex-1 bg-white border border-amber-200 rounded p-3 text-xs">
                        <p className="font-medium text-amber-700 mb-2">⚠ 料號「{item.sku}」已存在，資料有差異</p>
                        <div className="grid grid-cols-2 gap-3 text-gray-600">
                          <div><p className="text-gray-400 mb-0.5">現有名稱</p><p className="font-medium">{item.conflictName}</p></div>
                          <div><p className="text-gray-400 mb-0.5">匯入名稱</p><p className="font-medium">{item.name}</p></div>
                          <div><p className="text-gray-400 mb-0.5">現有規格</p><p className="line-clamp-2">{item.conflictSpec || '-'}</p></div>
                          <div><p className="text-gray-400 mb-0.5">匯入規格</p><p className="line-clamp-2">{item.specification || '-'}</p></div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0 pt-1">
                        <button type="button"
                          onClick={() => setProductDrafts(prev => prev.map((d, i) => i === idx ? { ...d, action: 'use-existing' } : d))}
                          className={`px-3 py-1.5 rounded text-xs font-medium ${item.action === 'use-existing' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>
                          使用現有
                        </button>
                        <button type="button"
                          onClick={() => setProductDrafts(prev => prev.map((d, i) => i === idx ? { ...d, action: 'create', sku: '' } : d))}
                          className={`px-3 py-1.5 rounded text-xs font-medium ${item.action === 'create' ? 'bg-orange-500 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>
                          建新產品
                        </button>
                      </div>
                    </div>
                  )}
                  {isMatched && <p className="text-xs text-green-600 mb-2">✓ 料號「{item.sku}」已存在且資料一致，將自動比對現有產品。</p>}

                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-3">
                      <label className="text-xs text-gray-500 mb-0.5 block">商品名稱</label>
                      <input type="text" value={item.name}
                        onChange={e => setProductDrafts(prev => prev.map((d, i) => i === idx ? { ...d, name: e.target.value } : d))}
                        className={inp} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 mb-0.5 block">料號</label>
                      <input type="text" value={item.sku}
                        onChange={e => setProductDrafts(prev => prev.map((d, i) => i === idx ? { ...d, sku: e.target.value } : d))}
                        className={`${inp} font-mono text-xs`} />
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs text-gray-500 mb-0.5 block">規格說明</label>
                      <input type="text" value={item.specification}
                        onChange={e => setProductDrafts(prev => prev.map((d, i) => i === idx ? { ...d, specification: e.target.value } : d))}
                        className={inp} />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-500 mb-0.5 block">數量</label>
                      <input type="number" value={item.qty}
                        onChange={e => setProductDrafts(prev => prev.map((d, i) => i === idx ? { ...d, qty: e.target.value } : d))}
                        className={`${inp} text-right`} />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-500 mb-0.5 block">單位</label>
                      <input type="text" value={item.unit}
                        onChange={e => setProductDrafts(prev => prev.map((d, i) => i === idx ? { ...d, unit: e.target.value } : d))}
                        className={inp} />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-500 mb-0.5 block">單價</label>
                      <input type="number" step="0.0001" value={item.unitPrice}
                        onChange={e => setProductDrafts(prev => prev.map((d, i) => i === idx ? { ...d, unitPrice: e.target.value } : d))}
                        className={`${inp} text-right`} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex justify-between">
            <button type="button" onClick={() => { setMode('upload'); setError('') }} className="text-sm text-gray-400 hover:text-gray-600">← 重新上傳</button>
            <button type="button" onClick={() => { setError(''); setMode('supplier') }} className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
              產品資料確認，繼續 →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 步驟 2：確認供應商（只是 review，不寫 DB）
  // ══════════════════════════════════════════════════════════════════════════════
  if (mode === 'supplier') {
    const ms = supplierDraft.matchedSupplier
    return (
      <div className="max-w-2xl space-y-4">
        <StepBar />
        <ErrorBar />
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">步驟 2：確認供應商</h2>
          <p className="text-xs text-gray-500 mb-5">確認資料正確後繼續，供應商將在最後一步一起寫入。</p>

          {ms && supplierDraft.action === 'use-existing' && (
            <div className="mb-5 bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-green-700 mb-2">✓ 找到現有供應商「{ms.name}」</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                {ms.shortName   && <div><span className="text-gray-400">簡稱：</span>{ms.shortName}</div>}
                {ms.email       && <div><span className="text-gray-400">Email：</span>{ms.email}</div>}
                {ms.phoneNo     && <div><span className="text-gray-400">電話：</span>{ms.phoneNo}</div>}
                {ms.paymentTerms && <div><span className="text-gray-400">付款：</span>{ms.paymentTerms}</div>}
                {ms.currencyCode && <div><span className="text-gray-400">幣別：</span>{ms.currencyCode}</div>}
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" className="px-3 py-1.5 bg-green-600 text-white text-xs rounded font-medium"
                  onClick={() => setSupplierDraft(d => ({ ...d, action: 'use-existing' }))}>✓ 是，使用此供應商</button>
                <button type="button" className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs rounded"
                  onClick={() => setSupplierDraft(d => ({ ...d, action: 'create', matchedId: null, matchedSupplier: null }))}>
                  不是，建立新供應商
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="供應商全名" required>
              <input type="text" value={supplierDraft.name} onChange={e => setSupplierDraft(d => ({ ...d, name: e.target.value }))} className={inp} />
            </Field>
            <Field label="簡稱">
              <input type="text" value={supplierDraft.shortName} onChange={e => setSupplierDraft(d => ({ ...d, shortName: e.target.value }))} className={inp} placeholder="例：EXCEL" />
            </Field>
            <Field label="Email">
              <input type="email" value={supplierDraft.email} onChange={e => setSupplierDraft(d => ({ ...d, email: e.target.value }))} className={inp} />
            </Field>
            <Field label="電話">
              <input type="text" value={supplierDraft.phone} onChange={e => setSupplierDraft(d => ({ ...d, phone: e.target.value }))} className={inp} />
            </Field>
            <Field label="城市">
              <input type="text" value={supplierDraft.city} onChange={e => setSupplierDraft(d => ({ ...d, city: e.target.value }))} className={inp} />
            </Field>
            <Field label="國家">
              <input type="text" value={supplierDraft.country} onChange={e => setSupplierDraft(d => ({ ...d, country: e.target.value }))} className={inp} placeholder="例：TAIWAN" />
            </Field>
            <div className="col-span-2">
              <Field label="地址">
                <input type="text" value={supplierDraft.address} onChange={e => setSupplierDraft(d => ({ ...d, address: e.target.value }))} className={inp} />
              </Field>
            </div>
            <Field label="慣用幣別">
              <select value={supplierDraft.currencyCode} onChange={e => { setSupplierDraft(d => ({ ...d, currencyCode: e.target.value })); setCurrencyCode(e.target.value) }} className={inp}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="付款條件">
              <input type="text" value={supplierDraft.paymentTerms} onChange={e => setSupplierDraft(d => ({ ...d, paymentTerms: e.target.value }))} className={inp} placeholder="T/T 30 days" />
            </Field>
          </div>

          <div className="flex justify-between mt-6">
            <button type="button" onClick={() => { setError(''); setMode('products') }} className="text-sm text-gray-400 hover:text-gray-600">← 上一步</button>
            <button type="button"
              onClick={() => { if (!supplierDraft.name.trim()) { setError('請填入供應商名稱'); return } setError(''); setMode('po') }}
              className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
              供應商資料確認，繼續 →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 步驟 3：確認採購單 → 送出（一次性寫入所有資料）
  // ══════════════════════════════════════════════════════════════════════════════
  const subtotal = productDrafts.reduce((s, d) => s + (parseFloat(d.qty) || 0) * (parseFloat(d.unitPrice) || 0), 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <StepBar />
      <ErrorBar />

      {/* 摘要卡片 */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="font-medium text-blue-700 mb-1">供應商</p>
          <p className="text-gray-800">{supplierDraft.name}</p>
          {supplierDraft.action === 'use-existing' && <p className="text-xs text-green-600 mt-0.5">使用現有供應商</p>}
          {supplierDraft.action === 'create' && <p className="text-xs text-orange-600 mt-0.5">將建立新供應商</p>}
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="font-medium text-blue-700 mb-1">產品</p>
          <p className="text-gray-800">{productDrafts.length} 項，小計 {currencyCode} {subtotal.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {productDrafts.filter(d => d.action === 'create').length} 筆新建 ／ {productDrafts.filter(d => d.action === 'use-existing').length} 筆沿用現有
          </p>
        </div>
      </div>

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">採購單資料</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="採購觸發來源" required>
            <select value={sourceType} onChange={e => setSourceType(e.target.value)} className={inp}>
              <option value="0">主動補貨（預測/季節/促銷）</option>
              <option value="1">接單後採購（Made to Order）</option>
              <option value="2">安全庫存觸發（低於警戒線）</option>
            </select>
          </Field>
          <Field label="原始單據號">
            <input type="text" value={docRefNo} onChange={e => setDocRefNo(e.target.value)} className={inp} placeholder="供應商發票號 / PO 號" />
          </Field>
          <Field label="幣別">
            <select value={currencyCode} onChange={e => setCurrencyCode(e.target.value)} className={inp}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={`匯率（${currencyCode} → TWD）`}>
            <input type="number" step="0.000001" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} className={inp}
              placeholder={currencyCode === 'TWD' ? '1' : '請填入當日匯率'} />
          </Field>
          <Field label="預計到貨日">
            <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className={inp} />
          </Field>
          <Field label="裝運港">
            <input type="text" value={port} onChange={e => setPort(e.target.value)} className={inp} placeholder="例：YANTIAN" />
          </Field>
          <Field label="運送方式">
            <select value={shipVia} onChange={e => setShipVia(e.target.value)} className={inp}>
              <option value="">請選擇</option>
              {SHIP_VIA.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="備註">
              <textarea value={note} onChange={e => setNote(e.target.value)} className={`${inp} h-20`} placeholder="付款條件、特殊要求等..." />
            </Field>
          </div>
        </div>
      </section>

      {/* 產品明細確認 */}
      <section className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-700">採購明細</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">商品</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">料號</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600">數量</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">單位</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600">單價</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600">小計</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {productDrafts.map((d, i) => (
              <tr key={i}>
                <td className="px-4 py-3">
                  <p>{d.action === 'use-existing' ? d.conflictName || d.name : d.name}</p>
                  <p className="text-xs text-gray-400 line-clamp-1">{d.specification}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.sku || '-'}</td>
                <td className="px-4 py-3 text-right">{d.qty}</td>
                <td className="px-4 py-3 text-gray-500">{d.unit}</td>
                <td className="px-4 py-3 text-right">{d.unitPrice}</td>
                <td className="px-4 py-3 text-right font-medium">
                  {((parseFloat(d.qty) || 0) * (parseFloat(d.unitPrice) || 0)).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50">
              <td colSpan={5} className="px-4 py-3 text-right font-medium text-gray-700">總金額</td>
              <td className="px-4 py-3 text-right font-bold text-gray-900">{currencyCode} {subtotal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-blue-600 text-white px-8 py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? '建立中…' : '✓ 確認並建立採購單'}
        </button>
        <button type="button" onClick={() => { setError(''); setMode('supplier') }} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">← 修改供應商</button>
        <button type="button" onClick={() => router.push('/dashboard')} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">取消</button>
      </div>
    </form>
  )
}

const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
      {children}
    </div>
  )
}
