'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SHIP_VIA, CURRENCIES } from '@/modules/purchase/poUtils'
import type { ParsedInvoice } from '@/app/api/ai/parse-invoice/route'
import type { AppliedProduct } from '@/app/api/ai/apply-products/route'
import type { AppliedSupplier } from '@/app/api/ai/apply-supplier/route'
import ProductPicker from '@/components/ProductPicker'

type Supplier = { id: number; name: string; shortName: string | null; currencyCode: string | null; email: string | null; phoneNo: string | null; address: string | null; city: string | null; countryCode: string | null; paymentTerms: string | null }
type Product  = { id: number; name: string; sku: string | null; unit: string | null; specification: string | null }
type LineItem = { productId: string; quantity: string; unitPrice: string; unit: string; note: string }

type ReviewProduct = {
  name: string; specification: string; sku: string
  qty: string; unitPrice: string; unit: string
  conflictId: number | null; conflictName: string; conflictSpec: string
  hasDiff: boolean; action: 'create' | 'use-existing'
}

type SupplierDraft = {
  name: string; shortName: string; email: string; phone: string
  address: string; city: string; country: string
  contactPerson: string; paymentTerms: string; currencyCode: string
  matchedId: number | null; matchedSupplier: Supplier | null
}

type Mode = 'upload' | 'products' | 'supplier' | 'po'

const emptyLine = (): LineItem => ({ productId: '', quantity: '', unitPrice: '', unit: '', note: '' })

export default function ImportWizard({
  suppliers: init,
  products: initP,
}: {
  suppliers: Supplier[]
  products: Product[]
}) {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState(init)
  const [products,  setProducts]  = useState(initP)
  const [mode, setMode] = useState<Mode>('upload')

  const [reviewItems,   setReviewItems]   = useState<ReviewProduct[]>([])
  const [supplierDraft, setSupplierDraft] = useState<SupplierDraft>({
    name: '', shortName: '', email: '', phone: '', address: '', city: '', country: '',
    contactPerson: '', paymentTerms: '', currencyCode: 'USD',
    matchedId: null, matchedSupplier: null,
  })

  // PO fields (step 3)
  const [supplierId,   setSupplierId]   = useState('')
  const [sourceType,   setSourceType]   = useState('0')
  const [docRefNo,     setDocRefNo]     = useState('')
  const [currencyCode, setCurrencyCode] = useState('USD')
  const [exchangeRate, setExchangeRate] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [port,         setPort]         = useState('')
  const [shipVia,      setShipVia]      = useState('')
  const [note,         setNote]         = useState('')
  const [items,        setItems]        = useState<LineItem[]>([emptyLine()])

  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [msg,     setMsg]     = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const stepLabels = ['上傳單據', '確認產品', '確認供應商', '確認採購單']
  const stepIndex  = { upload: 0, products: 1, supplier: 2, po: 3 }[mode]

  // ─── 步驟 0：上傳 & 解析 ──────────────────────────────────────────────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true); setMsg({ type: 'info', text: `解析中：${file.name}…` })
    e.target.value = ''
    try {
      const fd = new FormData(); fd.append('file', file)
      const res  = await fetch('/api/ai/parse-invoice', { method: 'POST', body: fd })
      const data = await res.json() as { data?: ParsedInvoice; error?: string }
      if (!res.ok) throw new Error(data.error ?? '解析失敗')
      const inv = data.data!

      // 本地 SKU 衝突偵測
      const reviewed: ReviewProduct[] = (inv.items ?? []).map(it => {
        const sku = it.sku?.trim() ?? ''
        const ex  = sku ? products.find(p => p.sku?.toLowerCase() === sku.toLowerCase()) : undefined
        const hasDiff = ex ? (
          ex.name.toLowerCase() !== (it.name?.trim() ?? '').toLowerCase() ||
          (ex.specification ?? '') !== (it.specification?.trim() ?? '')
        ) : false
        return {
          name: it.name?.trim() ?? '', specification: it.specification?.trim() ?? '',
          sku, qty: String(it.qty ?? 1), unitPrice: String(it.unitPrice ?? 0),
          unit: it.unit?.trim() ?? 'PCS',
          conflictId: ex?.id ?? null, conflictName: ex?.name ?? '', conflictSpec: ex?.specification ?? '',
          hasDiff, action: ex ? 'use-existing' : 'create',
        }
      })
      setReviewItems(reviewed)

      // 本地供應商比對
      const supName = inv.supplierName?.trim() ?? ''
      const matched = supName
        ? suppliers.find(s =>
            s.name.toLowerCase() === supName.toLowerCase() ||
            supName.toLowerCase().includes(s.name.toLowerCase()) ||
            s.name.toLowerCase().includes(supName.toLowerCase()) ||
            (s.shortName && s.shortName.toLowerCase() === supName.toLowerCase()))
        : undefined

      setSupplierDraft({
        name:          supName,
        shortName:     '',
        email:         inv.supplierEmail?.trim() ?? '',
        phone:         inv.supplierPhone?.trim() ?? '',
        address:       inv.supplierAddress?.trim() ?? '',
        city:          inv.supplierCity?.trim() ?? '',
        country:       inv.supplierCountry?.trim() ?? '',
        contactPerson: '',
        paymentTerms:  '',
        currencyCode:  inv.currency ?? 'USD',
        matchedId:     matched?.id ?? null,
        matchedSupplier: matched ?? null,
      })

      if (inv.invoiceNo) setDocRefNo(inv.invoiceNo)
      if (inv.currency)  setCurrencyCode(inv.currency)

      setMsg({ type: 'ok', text: `解析完成，共 ${reviewed.length} 項產品。請逐步確認後即可建立採購單。` })
      setMode('products')
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  // ─── 步驟 1：確認產品 ────────────────────────────────────────────────────────
  async function confirmProducts() {
    setLoading(true); setMsg({ type: 'info', text: '寫入產品資料…' })
    try {
      const res = await fetch('/api/ai/apply-products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: reviewItems.map(d => ({
            name:          d.action === 'use-existing' ? (d.conflictName || d.name) : d.name,
            specification: d.specification || null,
            sku:           d.sku || null,
            qty:           Number(d.qty),
            unitPrice:     Number(d.unitPrice),
            unit:          d.unit,
          })),
        }),
      })
      const data = await res.json() as { data?: AppliedProduct[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? '產品寫入失敗')
      const applied = data.data!

      const r = await fetch('/api/products?limit=2000')
      const fresh = r.ok ? ((await r.json()) as { products?: Product[] }).products ?? [] : products
      setProducts(fresh)
      setItems(applied.map(ap => ({
        productId: String(ap.productId), quantity: String(ap.qty),
        unitPrice: String(ap.unitPrice), unit: ap.unit, note: '',
      })))
      const nc = applied.filter(a => a.productCreated).length
      setMsg({ type: 'ok', text: `產品確認完成${nc ? `（新建 ${nc} 筆）` : ''}。` })
      setMode('supplier')
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  // ─── 步驟 2：確認供應商 ──────────────────────────────────────────────────────
  async function confirmSupplier() {
    if (!supplierDraft.name.trim()) { setError('請填入供應商名稱'); return }
    setLoading(true); setMsg({ type: 'info', text: '寫入供應商資料…' }); setError('')
    try {
      let resolvedId: number
      if (supplierDraft.matchedId) {
        resolvedId = supplierDraft.matchedId
      } else {
        const res = await fetch('/api/ai/apply-supplier', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierName:      supplierDraft.name,
            supplierEmail:     supplierDraft.email || null,
            supplierShortName: supplierDraft.shortName || null,
            contactPerson:     supplierDraft.contactPerson || null,
            paymentTerms:      supplierDraft.paymentTerms || null,
            currencyCode:      supplierDraft.currencyCode || null,
            phone:             supplierDraft.phone || null,
            address:           supplierDraft.address || null,
            city:              supplierDraft.city || null,
            country:           supplierDraft.country || null,
          }),
        })
        const data = await res.json() as { data?: AppliedSupplier; error?: string }
        if (!res.ok) throw new Error(data.error ?? '供應商寫入失敗')
        resolvedId = data.data!.supplierId
      }

      // 同時 refresh 兩份清單
      const [sr, pr] = await Promise.all([
        fetch('/api/suppliers?limit=500'),
        fetch('/api/products?limit=2000'),
      ])
      const freshSup  = sr.ok ? ((await sr.json()) as { suppliers?: Supplier[] }).suppliers ?? [] : suppliers
      const freshProd = pr.ok ? ((await pr.json()) as { products?: Product[] }).products ?? [] : products
      setSuppliers(freshSup); setProducts(freshProd)
      setSupplierId(String(resolvedId))
      if (supplierDraft.currencyCode) setCurrencyCode(supplierDraft.currencyCode)
      setMsg({ type: 'ok', text: `供應商確認完成（${supplierDraft.name}）。請最終確認採購單資料。` })
      setMode('po')
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  // ─── 步驟 3：儲存採購單 ──────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId) { setError('請選擇供應商'); return }
    const valid = items.filter(i => i.productId && i.quantity && i.unitPrice)
    if (!valid.length) { setError('請至少輸入一項採購明細'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/purchases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId, sourceType: Number(sourceType),
        currencyCode, exchangeRate: exchangeRate || '1',
        expectedDate, port, shipVia,
        note: [docRefNo ? `單據號：${docRefNo}` : '', note].filter(Boolean).join('\n'),
        items: valid.map(i => ({ productId: Number(i.productId), quantity: Number(i.quantity), unitPrice: i.unitPrice, unit: i.unit, note: i.note })),
      }),
    })
    setSaving(false)
    if (!res.ok) { setError('儲存失敗，請再試一次'); return }
    router.push(`/purchases/${(await res.json()).id}`)
    router.refresh()
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

  const Msg = () => !msg ? null : (
    <div className={`rounded-lg px-4 py-3 text-sm mb-4 ${msg.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-700' : msg.type === 'err' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
      {msg.text}
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════════
  // 步驟 0：上傳
  // ══════════════════════════════════════════════════════════════════════════════
  if (mode === 'upload') {
    return (
      <div className="max-w-2xl">
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.txt" className="hidden" onChange={handleFile} />
        {loading ? (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-10 text-center">
            <p className="text-3xl mb-3">⏳</p>
            <p className="text-purple-700 font-medium">{msg?.text}</p>
          </div>
        ) : msg?.type === 'err' ? (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {msg.text}
            <button onClick={() => setMsg(null)} className="ml-2 underline text-xs">關閉</button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-4 bg-white border-2 border-dashed border-purple-300 rounded-xl p-12 hover:border-purple-500 hover:bg-purple-50 transition-all text-center">
            <span className="text-5xl">📄</span>
            <div>
              <p className="font-semibold text-gray-800 text-lg">點擊上傳採購單或形式發票</p>
              <p className="text-sm text-gray-500 mt-1">支援 PDF、Excel、圖片（JPG / PNG）</p>
              <p className="text-xs text-purple-600 mt-3">AI 自動識別供應商、料號、數量、單價</p>
            </div>
          </button>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 步驟 1：確認產品
  // ══════════════════════════════════════════════════════════════════════════════
  if (mode === 'products') {
    return (
      <div className="max-w-5xl space-y-4">
        <StepBar /><Msg />
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">步驟 1：確認產品資料</h2>
            <p className="text-xs text-gray-500 mt-0.5">確認後寫入產品資料庫。<span className="text-amber-600">⚠ 黃底 = 料號已存在但資料有差異</span></p>
          </div>
          <div className="divide-y divide-gray-50">
            {reviewItems.map((item, idx) => {
              const isConflict = item.conflictId !== null && item.hasDiff
              const isMatched  = item.conflictId !== null && !item.hasDiff
              return (
                <div key={idx} className={`px-6 py-4 ${isConflict ? 'bg-amber-50' : ''}`}>
                  {isConflict && (
                    <div className="mb-3 flex items-start gap-3">
                      <div className="flex-1 bg-white border border-amber-200 rounded p-3 text-xs">
                        <p className="font-medium text-amber-700 mb-2">⚠ 料號「{item.sku}」已存在，資料有差異</p>
                        <div className="grid grid-cols-2 gap-3 text-gray-600">
                          <div><p className="text-gray-400 mb-0.5">現有名稱</p><p className="font-medium">{item.conflictName || '-'}</p></div>
                          <div><p className="text-gray-400 mb-0.5">匯入名稱</p><p className="font-medium">{item.name || '-'}</p></div>
                          <div><p className="text-gray-400 mb-0.5">現有規格</p><p className="line-clamp-2">{item.conflictSpec || '-'}</p></div>
                          <div><p className="text-gray-400 mb-0.5">匯入規格</p><p className="line-clamp-2">{item.specification || '-'}</p></div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0 pt-1">
                        <button type="button" onClick={() => setReviewItems(prev => prev.map((d, i) => i === idx ? { ...d, action: 'use-existing' } : d))}
                          className={`px-3 py-1.5 rounded text-xs font-medium ${item.action === 'use-existing' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-400'}`}>
                          使用現有
                        </button>
                        <button type="button" onClick={() => setReviewItems(prev => prev.map((d, i) => i === idx ? { ...d, action: 'create', sku: '' } : d))}
                          className={`px-3 py-1.5 rounded text-xs font-medium ${item.action === 'create' ? 'bg-orange-500 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:border-orange-400'}`}>
                          建新產品
                        </button>
                      </div>
                    </div>
                  )}
                  {isMatched && <p className="text-xs text-green-600 mb-2">✓ 料號「{item.sku}」已存在且資料一致，自動比對現有產品。</p>}
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-3">
                      <label className="text-xs text-gray-500 mb-0.5 block">商品名稱</label>
                      <input type="text" value={item.name} onChange={e => setReviewItems(prev => prev.map((d, i) => i === idx ? { ...d, name: e.target.value } : d))} className={inp} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 mb-0.5 block">料號</label>
                      <input type="text" value={item.sku} onChange={e => setReviewItems(prev => prev.map((d, i) => i === idx ? { ...d, sku: e.target.value } : d))} className={`${inp} font-mono text-xs`} />
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs text-gray-500 mb-0.5 block">規格說明</label>
                      <input type="text" value={item.specification} onChange={e => setReviewItems(prev => prev.map((d, i) => i === idx ? { ...d, specification: e.target.value } : d))} className={inp} />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-500 mb-0.5 block">數量</label>
                      <input type="number" value={item.qty} onChange={e => setReviewItems(prev => prev.map((d, i) => i === idx ? { ...d, qty: e.target.value } : d))} className={`${inp} text-right`} />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-500 mb-0.5 block">單位</label>
                      <input type="text" value={item.unit} onChange={e => setReviewItems(prev => prev.map((d, i) => i === idx ? { ...d, unit: e.target.value } : d))} className={inp} />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-500 mb-0.5 block">單價</label>
                      <input type="number" step="0.0001" value={item.unitPrice} onChange={e => setReviewItems(prev => prev.map((d, i) => i === idx ? { ...d, unitPrice: e.target.value } : d))} className={`${inp} text-right`} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-between">
            <button type="button" onClick={() => { setMode('upload'); setMsg(null) }} className="text-sm text-gray-400 hover:text-gray-600">← 重新上傳</button>
            <button type="button" onClick={confirmProducts} disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? '寫入中…' : '確認產品，繼續 →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 步驟 2：確認供應商
  // ══════════════════════════════════════════════════════════════════════════════
  if (mode === 'supplier') {
    const isNew = supplierDraft.matchedId === null
    const ms    = supplierDraft.matchedSupplier

    return (
      <div className="max-w-2xl space-y-4">
        <StepBar /><Msg />
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">步驟 2：確認供應商</h2>
          <p className="text-xs text-gray-500 mb-5">
            {isNew ? '此供應商尚未在系統中，填寫完整資料後建立。' : `系統找到現有供應商，請確認是否為同一家。`}
          </p>

          {!isNew && ms && (
            <div className="mb-5 bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-green-700 mb-3">✓ 找到現有供應商「{ms.name}」</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                {ms.shortName     && <div><span className="text-gray-400">簡稱：</span>{ms.shortName}</div>}
                {ms.email         && <div><span className="text-gray-400">Email：</span>{ms.email}</div>}
                {ms.phoneNo       && <div><span className="text-gray-400">電話：</span>{ms.phoneNo}</div>}
                {ms.paymentTerms  && <div><span className="text-gray-400">付款：</span>{ms.paymentTerms}</div>}
                {ms.currencyCode  && <div><span className="text-gray-400">幣別：</span>{ms.currencyCode}</div>}
                {(ms.city || ms.countryCode) && <div className="col-span-2"><span className="text-gray-400">地址：</span>{[ms.address, ms.city, ms.countryCode].filter(Boolean).join(', ')}</div>}
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" className="px-3 py-1.5 bg-green-600 text-white text-xs rounded font-medium"
                  onClick={() => {}}>✓ 是，使用此供應商</button>
                <button type="button" className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs rounded hover:border-red-400"
                  onClick={() => setSupplierDraft(d => ({ ...d, matchedId: null, matchedSupplier: null }))}>
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
              <select value={supplierDraft.currencyCode} onChange={e => setSupplierDraft(d => ({ ...d, currencyCode: e.target.value }))} className={inp}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="付款條件">
              <input type="text" value={supplierDraft.paymentTerms} onChange={e => setSupplierDraft(d => ({ ...d, paymentTerms: e.target.value }))} className={inp} placeholder="T/T 30 days" />
            </Field>
          </div>

          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          <div className="flex justify-between mt-6">
            <button type="button" onClick={() => { setMode('products'); setMsg(null); setError('') }} className="text-sm text-gray-400 hover:text-gray-600">← 上一步</button>
            <button type="button" onClick={confirmSupplier} disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? '寫入中…' : `${supplierDraft.matchedId ? '使用現有供應商' : '建立供應商'}，繼續 →`}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 步驟 3：確認採購單
  // ══════════════════════════════════════════════════════════════════════════════
  const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0)
  const getSpec  = (id: string) => products.find(p => String(p.id) === id)?.specification ?? ''
  const getSku   = (id: string) => products.find(p => String(p.id) === id)?.sku ?? ''

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <StepBar />
      {msg?.type === 'ok' && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">{msg.text}</div>
      )}

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">採購資訊</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="採購觸發來源" required>
            <select value={sourceType} onChange={e => setSourceType(e.target.value)} className={inp}>
              <option value="0">主動補貨（預測/季節/促銷）</option>
              <option value="1">接單後採購（Made to Order）</option>
              <option value="2">安全庫存觸發（低於警戒線）</option>
            </select>
          </Field>
          <Field label="原始單據號">
            <input type="text" value={docRefNo} onChange={e => setDocRefNo(e.target.value)} className={inp} />
          </Field>
          <Field label="供應商" required>
            <select value={supplierId} onChange={e => { setSupplierId(e.target.value); const s = suppliers.find(x => String(x.id) === e.target.value); if (s?.currencyCode) setCurrencyCode(s.currencyCode) }} className={inp} required>
              <option value="">請選擇</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.shortName ?? s.name}</option>)}
            </select>
          </Field>
          <Field label="幣別">
            <select value={currencyCode} onChange={e => setCurrencyCode(e.target.value)} className={inp}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={`匯率（${currencyCode} → TWD）`}>
            <input type="number" step="0.000001" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} className={inp} placeholder={currencyCode === 'TWD' ? '1' : '請填入當日匯率'} />
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

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">採購明細</h2>
        <div className="grid grid-cols-12 gap-2 mb-2 text-xs text-gray-500 font-medium">
          <div className="col-span-5">商品（名稱 / 料號）</div>
          <div className="col-span-2 text-right">數量</div>
          <div className="col-span-1">單位</div>
          <div className="col-span-2 text-right">單價 ({currencyCode})</div>
          <div className="col-span-2 text-right">小計</div>
        </div>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="border-b border-gray-50 pb-3">
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <ProductPicker products={products} value={item.productId}
                    onChange={(id, unit) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, productId: id, unit: unit || it.unit } : it))} />
                </div>
                <div className="col-span-2">
                  <input type="number" min="1" value={item.quantity} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: e.target.value } : it))} className={`${inp} text-right`} placeholder="0" />
                </div>
                <div className="col-span-1">
                  <input type="text" value={item.unit} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, unit: e.target.value } : it))} className={inp} />
                </div>
                <div className="col-span-2">
                  <input type="number" step="0.0001" value={item.unitPrice} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, unitPrice: e.target.value } : it))} className={`${inp} text-right`} placeholder="0.00" />
                </div>
                <div className="col-span-1 text-right text-sm text-gray-500 pr-1">
                  {((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}
                </div>
                <div className="col-span-1 flex justify-end">
                  {items.length > 1 && <button type="button" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>}
                </div>
              </div>
              {(getSku(item.productId) || getSpec(item.productId)) && (
                <div className="mt-1 ml-0.5 text-xs text-gray-400 space-y-0.5">
                  {getSku(item.productId)  && <div>料號：<span className="font-mono text-gray-600">{getSku(item.productId)}</span></div>}
                  {getSpec(item.productId) && <div className="line-clamp-2">規格：{getSpec(item.productId)}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setItems(prev => [...prev, emptyLine()])} className="mt-3 text-sm text-blue-600 hover:underline">+ 新增一行</button>
        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
          <span className="text-sm text-gray-500">總金額：</span>
          <span className="text-lg font-semibold text-gray-800 ml-2">{currencyCode} {subtotal.toFixed(2)}</span>
        </div>
      </section>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? '儲存中...' : '建立採購單'}
        </button>
        <button type="button" onClick={() => setMode('supplier')} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">← 修改供應商</button>
        <button type="button" onClick={() => router.push('/dashboard')} className="border border-gray-300 text-gray-700 px-6 py-2 rounded-md text-sm hover:bg-gray-50">取消</button>
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
