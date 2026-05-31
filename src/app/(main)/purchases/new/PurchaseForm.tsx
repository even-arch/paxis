'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SHIP_VIA, CURRENCIES } from '@/modules/purchase/poUtils'
import type { ParsedInvoice } from '@/app/api/ai/parse-invoice/route'
import type { AppliedProduct } from '@/app/api/ai/apply-products/route'
import type { AppliedSupplier } from '@/app/api/ai/apply-supplier/route'
import ProductPicker from '@/components/ProductPicker'

type Supplier = { id: number; name: string; shortName: string | null; currencyCode: string | null }
type Product  = { id: number; name: string; sku: string | null; unit: string | null; specification: string | null }
type LineItem = { productId: string; quantity: string; unitPrice: string; unit: string; note: string }

// 步驟 1 的可編輯草稿
type DraftItem = {
  name: string
  specification: string
  sku: string
  qty: string
  unitPrice: string
  unit: string
}

const emptyLine = (): LineItem => ({ productId: '', quantity: '', unitPrice: '', unit: '', note: '' })

type Mode = 'choose' | 'review-products' | 'review-supplier' | 'form'

export default function PurchaseForm({
  suppliers: initSuppliers,
  products:  initProducts,
}: {
  suppliers: Supplier[]
  products:  Product[]
}) {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<Supplier[]>(initSuppliers)
  const [products,  setProducts]  = useState<Product[]>(initProducts)
  const [mode, setMode] = useState<Mode>('choose')

  // ── 解析暫存 ─────────────────────────────────────────────────────────────────
  const [parsed,    setParsed]    = useState<ParsedInvoice | null>(null)
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [draftSupplierName,  setDraftSupplierName]  = useState('')
  const [draftSupplierEmail, setDraftSupplierEmail] = useState('')

  // ── PO 表單欄位 ───────────────────────────────────────────────────────────────
  const [supplierId,     setSupplierId]     = useState('')
  const [sourceType,     setSourceType]     = useState('0')
  const [docRefNo,       setDocRefNo]       = useState('')
  const [currencyCode,   setCurrencyCode]   = useState('USD')
  const [exchangeRate,   setExchangeRate]   = useState('')
  const [expectedDate,   setExpectedDate]   = useState('')
  const [port,           setPort]           = useState('')
  const [shipVia,        setShipVia]        = useState('')
  const [patiscoOrderNo, setPatiscoOrderNo] = useState('')
  const [note,           setNote]           = useState('')
  const [items,          setItems]          = useState<LineItem[]>([emptyLine()])

  const [error,   setError]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  // ── 步驟 0：上傳 & AI 解析 ────────────────────────────────────────────────────
  async function handleAiParse(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setMsg({ type: 'info', text: `AI 解析中：${file.name}…` })
    e.target.value = ''

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/ai/parse-invoice', { method: 'POST', body: fd })
      const data = await res.json() as { data?: ParsedInvoice; error?: string }
      if (!res.ok) throw new Error(data.error ?? '解析失敗')

      const inv = data.data!
      setParsed(inv)
      setDraftItems((inv.items ?? []).map(it => ({
        name:          it.name ?? '',
        specification: it.specification ?? '',
        sku:           it.sku ?? '',
        qty:           String(it.qty ?? 1),
        unitPrice:     String(it.unitPrice ?? 0),
        unit:          it.unit ?? 'PCS',
      })))
      setDraftSupplierName(inv.supplierName ?? '')
      setDraftSupplierEmail(inv.supplierEmail ?? '')
      if (inv.invoiceNo) setDocRefNo(inv.invoiceNo)
      if (inv.currency)  setCurrencyCode(inv.currency)

      setMsg({ type: 'ok', text: `解析完成，共 ${inv.items?.length ?? 0} 項。請依序確認產品與供應商資料。` })
      setMode('review-products')
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  // ── 步驟 1：確認產品 → 寫入 DB ────────────────────────────────────────────────
  async function confirmProducts() {
    setLoading(true)
    setMsg({ type: 'info', text: '正在確認並寫入產品資料…' })
    try {
      const res = await fetch('/api/ai/apply-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: draftItems.map(d => ({
            name:          d.name,
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
      // refresh 產品清單（產品已在 DB，清單加進來）
      const r = await fetch('/api/products?limit=2000')
      if (r.ok) {
        const d = await r.json() as { products?: Product[] }
        setProducts(d.products ?? [])
      }

      // 把 applied productId 記到 items state（為步驟 3 準備）
      setItems(applied.map(ap => ({
        productId: String(ap.productId),
        quantity:  String(ap.qty),
        unitPrice: String(ap.unitPrice),
        unit:      ap.unit,
        note:      '',
      })))

      const newCount = applied.filter(a => a.productCreated).length
      setMsg({ type: 'ok', text: `產品確認完成${newCount ? `（新建 ${newCount} 筆）` : ''}，請繼續確認供應商。` })
      setMode('review-supplier')
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  // ── 步驟 2：確認供應商 → 寫入 DB ──────────────────────────────────────────────
  async function confirmSupplier() {
    if (!draftSupplierName.trim()) { setError('請填入供應商名稱'); return }
    setLoading(true)
    setMsg({ type: 'info', text: '正在確認並寫入供應商資料…' })
    setError('')
    try {
      const res = await fetch('/api/ai/apply-supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierName: draftSupplierName, supplierEmail: draftSupplierEmail || null }),
      })
      const data = await res.json() as { data?: AppliedSupplier; error?: string }
      if (!res.ok) throw new Error(data.error ?? '供應商寫入失敗')

      const applied = data.data!

      // refresh 供應商清單後再設定 supplierId（同一 batch）
      const r = await fetch('/api/suppliers?limit=500')
      if (r.ok) {
        const d = await r.json() as { suppliers?: Supplier[] }
        setSuppliers(d.suppliers ?? [])
      }
      setSupplierId(String(applied.supplierId))

      setMsg({
        type: 'ok',
        text: `供應商確認完成${applied.supplierCreated ? `（新建：${applied.supplierName}）` : `（已有：${applied.supplierName}）`}。請檢查採購單資料後儲存。`,
      })
      setMode('form')
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  // ── 步驟 3：提交採購單 ────────────────────────────────────────────────────────
  function getProductSpec(productId: string) {
    return products.find(p => String(p.id) === productId)?.specification ?? ''
  }
  function getProductSku(productId: string) {
    return products.find(p => String(p.id) === productId)?.sku ?? ''
  }
  function addLine()               { setItems(prev => [...prev, emptyLine()]) }
  function removeLine(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }
  function setItem(idx: number, field: keyof LineItem, value: string) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const next = { ...item, [field]: value }
      if (field === 'productId') {
        const p = products.find(p => String(p.id) === value)
        if (p?.unit) next.unit = p.unit
      }
      return next
    }))
  }

  function handleSupplierChange(id: string) {
    setSupplierId(id)
    const sup = suppliers.find(s => String(s.id) === id)
    if (sup?.currencyCode) setCurrencyCode(sup.currencyCode)
  }

  const subtotal = items.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)
  }, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId)  { setError('請選擇供應商'); return }
    const validItems = items.filter(i => i.productId && i.quantity && i.unitPrice)
    if (!validItems.length) { setError('請至少輸入一項採購明細'); return }

    setSaving(true)
    setError('')
    const res = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId, sourceType: Number(sourceType),
        currencyCode, exchangeRate: exchangeRate || '1',
        expectedDate, port, shipVia, patiscoOrderNo,
        note: [docRefNo ? `單據號：${docRefNo}` : '', note].filter(Boolean).join('\n'),
        items: validItems.map(i => ({
          productId: Number(i.productId),
          quantity:  Number(i.quantity),
          unitPrice: i.unitPrice,
          unit:      i.unit,
          note:      i.note,
        })),
      }),
    })
    setSaving(false)
    if (!res.ok) { setError('儲存失敗，請再試一次'); return }
    const data = await res.json()
    router.push(`/purchases/${data.id}`)
    router.refresh()
  }

  // ── 共用：訊息列 ──────────────────────────────────────────────────────────────
  const MsgBar = () => msg ? (
    <div className={`rounded-lg px-4 py-3 text-sm mb-4 ${
      msg.type === 'ok'   ? 'bg-green-50 border border-green-200 text-green-700' :
      msg.type === 'err'  ? 'bg-red-50 border border-red-200 text-red-700' :
                            'bg-blue-50 border border-blue-200 text-blue-700'
    }`}>{msg.text}</div>
  ) : null

  // ── 進度條 ────────────────────────────────────────────────────────────────────
  const stepIndex = { choose: 0, 'review-products': 1, 'review-supplier': 2, form: 3 }[mode]
  const steps = ['上傳單據', '確認產品', '確認供應商', '填寫採購單']

  const StepBar = () => (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${
            i < stepIndex ? 'text-green-600' : i === stepIndex ? 'text-blue-600' : 'text-gray-400'
          }`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs border ${
              i < stepIndex  ? 'bg-green-100 border-green-400 text-green-700' :
              i === stepIndex ? 'bg-blue-100 border-blue-400 text-blue-700' :
                               'bg-gray-100 border-gray-300 text-gray-400'
            }`}>
              {i < stepIndex ? '✓' : i + 1}
            </span>
            {s}
          </div>
          {i < steps.length - 1 && (
            <div className={`mx-2 h-px w-8 ${i < stepIndex ? 'bg-green-300' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════════
  // 選擇畫面
  // ══════════════════════════════════════════════════════════════════════════════
  if (mode === 'choose') {
    return (
      <div className="max-w-2xl">
        <input ref={fileRef} type="file"
          accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.txt"
          className="hidden" onChange={handleAiParse} />

        {loading && (
          <div className="mb-6 bg-purple-50 border border-purple-200 rounded-xl p-6 text-center">
            <p className="text-2xl mb-2">⏳</p>
            <p className="text-purple-700 font-medium">{msg?.text}</p>
          </div>
        )}
        {msg?.type === 'err' && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {msg.text}
            <button onClick={() => setMsg(null)} className="ml-2 underline text-xs">關閉</button>
          </div>
        )}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 bg-white border-2 border-purple-300 rounded-xl p-8 hover:border-purple-500 hover:bg-purple-50 transition-all text-center">
              <span className="text-4xl">✨</span>
              <div>
                <p className="font-semibold text-gray-800 text-base">上傳單據，AI 自動填寫</p>
                <p className="text-xs text-gray-500 mt-1">支援 PDF、Excel、圖片</p>
                <p className="text-xs text-purple-600 mt-2">自動識別供應商、料號、數量、單價</p>
              </div>
            </button>
            <button type="button" onClick={() => setMode('form')}
              className="flex flex-col items-center justify-center gap-3 bg-white border-2 border-gray-200 rounded-xl p-8 hover:border-gray-400 hover:bg-gray-50 transition-all text-center">
              <span className="text-4xl">📝</span>
              <div>
                <p className="font-semibold text-gray-800 text-base">手動輸入</p>
                <p className="text-xs text-gray-500 mt-1">自行填寫所有欄位</p>
              </div>
            </button>
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 步驟 1：確認產品
  // ══════════════════════════════════════════════════════════════════════════════
  if (mode === 'review-products') {
    return (
      <div className="max-w-5xl space-y-4">
        <StepBar />
        <MsgBar />

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-800">步驟 1：確認產品資料</h2>
              <p className="text-xs text-gray-500 mt-0.5">確認後，這些產品將寫入產品資料庫。可以在這裡修改名稱、料號、規格。</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-48">商品名稱</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-32">料號 (SKU)</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">規格說明</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600 w-20">數量</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-16">單位</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600 w-24">單價</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {draftItems.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2">
                      <input type="text" value={item.name}
                        onChange={e => setDraftItems(prev => prev.map((d, i) => i === idx ? { ...d, name: e.target.value } : d))}
                        className={inp} placeholder="商品名稱" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={item.sku}
                        onChange={e => setDraftItems(prev => prev.map((d, i) => i === idx ? { ...d, sku: e.target.value } : d))}
                        className={`${inp} font-mono text-xs`} placeholder="料號" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={item.specification}
                        onChange={e => setDraftItems(prev => prev.map((d, i) => i === idx ? { ...d, specification: e.target.value } : d))}
                        className={inp} placeholder="規格說明" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={item.qty}
                        onChange={e => setDraftItems(prev => prev.map((d, i) => i === idx ? { ...d, qty: e.target.value } : d))}
                        className={`${inp} text-right`} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={item.unit}
                        onChange={e => setDraftItems(prev => prev.map((d, i) => i === idx ? { ...d, unit: e.target.value } : d))}
                        className={inp} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.0001" value={item.unitPrice}
                        onChange={e => setDraftItems(prev => prev.map((d, i) => i === idx ? { ...d, unitPrice: e.target.value } : d))}
                        className={`${inp} text-right`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <button type="button" onClick={() => { setMode('choose'); setMsg(null) }}
              className="text-sm text-gray-400 hover:text-gray-600">← 重新上傳</button>
            <button type="button" onClick={confirmProducts} disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
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
  if (mode === 'review-supplier') {
    return (
      <div className="max-w-2xl space-y-4">
        <StepBar />
        <MsgBar />

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">步驟 2：確認供應商資料</h2>
          <p className="text-xs text-gray-500 mb-5">確認後，供應商將寫入供應商資料庫（若已存在則比對現有資料）。</p>

          <div className="space-y-4">
            <Field label="供應商名稱" required>
              <input type="text" value={draftSupplierName}
                onChange={e => setDraftSupplierName(e.target.value)}
                className={inp} placeholder="例：EXCEL SPORTS INC." />
            </Field>
            <Field label="供應商 Email">
              <input type="email" value={draftSupplierEmail}
                onChange={e => setDraftSupplierEmail(e.target.value)}
                className={inp} placeholder="example@supplier.com" />
            </Field>
          </div>

          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

          <div className="flex items-center justify-between mt-6">
            <button type="button" onClick={() => { setMode('review-products'); setMsg(null); setError('') }}
              className="text-sm text-gray-400 hover:text-gray-600">← 上一步</button>
            <button type="button" onClick={confirmSupplier} disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? '寫入中…' : '確認供應商，繼續 →'}
            </button>
          </div>
        </div>

        {parsed && (
          <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500">
            <p className="font-medium text-gray-600 mb-1">AI 原始解析（參考）</p>
            <p>文件類型：{parsed.documentType ?? '未知'}</p>
            <p>單據號：{parsed.invoiceNo ?? '-'}</p>
            <p>幣別：{parsed.currency ?? '-'}</p>
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 步驟 3：採購單表單
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <StepBar />

      {msg?.type === 'ok' && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          {msg.text}
        </div>
      )}

      {/* 採購資訊 */}
      <section className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-700">步驟 3：填寫採購單</h2>
          {parsed && (
            <button type="button" onClick={() => { setMode('choose'); setMsg(null) }}
              className="text-xs text-gray-400 hover:text-purple-600">✨ 重新上傳單據</button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="採購觸發來源" required>
            <select value={sourceType} onChange={e => setSourceType(e.target.value)} className={inp}>
              <option value="0">主動補貨（預測/季節/促銷）</option>
              <option value="1">接單後採購（Made to Order）</option>
              <option value="2">安全庫存觸發（低於警戒線）</option>
            </select>
          </Field>

          <Field label="原始單據號">
            <input type="text" value={docRefNo} onChange={e => setDocRefNo(e.target.value)}
              className={inp} placeholder="供應商發票號 / PO 號" />
          </Field>

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

          <Field label={`匯率（${currencyCode} → TWD）`}>
            <input type="number" step="0.000001" value={exchangeRate}
              onChange={e => setExchangeRate(e.target.value)} className={inp}
              placeholder={currencyCode === 'TWD' ? '1' : '請填入當日匯率'} />
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

          <Field label="Patisco 訂單號（溯源用）">
            <input type="text" value={patiscoOrderNo} onChange={e => setPatiscoOrderNo(e.target.value)}
              className={inp} placeholder="例：ORD-20240530-0001" />
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

        <div className="grid grid-cols-12 gap-2 mb-2 text-xs text-gray-500 font-medium">
          <div className="col-span-5">商品（名稱 / 料號）</div>
          <div className="col-span-2 text-right">數量</div>
          <div className="col-span-1">單位</div>
          <div className="col-span-2 text-right">單價 ({currencyCode})</div>
          <div className="col-span-2 text-right">小計</div>
        </div>

        <div className="space-y-2">
          {items.map((item, idx) => {
            const spec = getProductSpec(item.productId)
            const sku  = getProductSku(item.productId)
            return (
              <div key={idx} className="border-b border-gray-50 pb-3">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <ProductPicker
                      products={products}
                      value={item.productId}
                      onChange={(id, unit) => {
                        setItems(prev => prev.map((it, i) => i === idx
                          ? { ...it, productId: id, unit: unit || it.unit }
                          : it))
                      }}
                    />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="1" value={item.quantity}
                      onChange={e => setItem(idx, 'quantity', e.target.value)}
                      className={`${inp} text-right`} placeholder="0" />
                  </div>
                  <div className="col-span-1">
                    <input type="text" value={item.unit}
                      onChange={e => setItem(idx, 'unit', e.target.value)} className={inp} />
                  </div>
                  <div className="col-span-2">
                    <input type="number" step="0.0001" value={item.unitPrice}
                      onChange={e => setItem(idx, 'unitPrice', e.target.value)}
                      className={`${inp} text-right`} placeholder="0.00" />
                  </div>
                  <div className="col-span-1 text-right text-sm text-gray-500 pr-1">
                    {((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeLine(idx)}
                        className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                    )}
                  </div>
                </div>
                {(sku || spec) && (
                  <div className="mt-1 ml-0.5 text-xs text-gray-400 space-y-0.5">
                    {sku  && <div>料號：<span className="font-mono text-gray-600">{sku}</span></div>}
                    {spec && <div className="line-clamp-2">規格：{spec}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button type="button" onClick={addLine} className="mt-3 text-sm text-blue-600 hover:underline">
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
        {parsed && (
          <button type="button" onClick={() => setMode('review-supplier')}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
            ← 修改供應商
          </button>
        )}
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
