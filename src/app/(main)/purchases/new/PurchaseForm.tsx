'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SHIP_VIA, CURRENCIES } from '@/modules/purchase/poUtils'
import type { ParsedInvoice } from '@/app/api/ai/parse-invoice/route'
import type { AppliedInvoice } from '@/app/api/ai/apply-invoice/route'
import ProductPicker from '@/components/ProductPicker'

type Supplier = { id: number; name: string; shortName: string | null; currencyCode: string | null }
type Product  = { id: number; name: string; sku: string | null; unit: string | null; specification: string | null }
type LineItem = { productId: string; quantity: string; unitPrice: string; unit: string; note: string }

const emptyLine = (): LineItem => ({ productId: '', quantity: '', unitPrice: '', unit: '', note: '' })

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

  const [supplierId,     setSupplierId]     = useState('')
  const [sourceType,     setSourceType]     = useState('0')
  const [docRefNo,       setDocRefNo]       = useState('')   // 原始單據號（AI 解析後填入）
  const [currencyCode,   setCurrencyCode]   = useState('USD')
  const [exchangeRate,   setExchangeRate]   = useState('')   // 空字串提示使用者填入
  const [expectedDate,   setExpectedDate]   = useState('')
  const [port,           setPort]           = useState('')
  const [shipVia,        setShipVia]        = useState('')
  const [patiscoOrderNo, setPatiscoOrderNo] = useState('')
  const [note,           setNote]           = useState('')
  const [items,          setItems]          = useState<LineItem[]>([emptyLine()])
  const [error,          setError]          = useState('')
  const [saving,         setSaving]         = useState(false)

  const [mode,      setMode]      = useState<'choose' | 'form'>('choose')
  const fileRef = useRef<HTMLInputElement>(null)
  const [aiParsing, setAiParsing] = useState(false)
  const [aiMsg,     setAiMsg]     = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null)
  const [applyLog,  setApplyLog]  = useState<string[]>([])

  function handleSupplierChange(id: string) {
    setSupplierId(id)
    const sup = suppliers.find(s => String(s.id) === id)
    if (sup?.currencyCode) setCurrencyCode(sup.currencyCode)
  }

  function getProductSpec(productId: string): string {
    return products.find(p => String(p.id) === productId)?.specification ?? ''
  }
  function getProductSku(productId: string): string {
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

  async function handleAiParse(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAiParsing(true)
    setAiMsg({ type: 'info', text: `步驟 1/2：AI 解析中：${file.name}…` })
    setApplyLog([])
    e.target.value = ''

    try {
      const fd = new FormData()
      fd.append('file', file)
      const parseRes = await fetch('/api/ai/parse-invoice', { method: 'POST', body: fd })
      const parseData = await parseRes.json() as { data?: ParsedInvoice; error?: string }
      if (!parseRes.ok) throw new Error(parseData.error ?? '解析失敗')

      setAiMsg({ type: 'info', text: '步驟 2/2：自動建立供應商與產品…' })

      const applyRes = await fetch('/api/ai/apply-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseData.data),
      })
      const applyData = await applyRes.json() as { data?: AppliedInvoice; error?: string }
      if (!applyRes.ok) throw new Error(applyData.error ?? '建立失敗')

      const applied = applyData.data!
      const log: string[] = []

      // 供應商
      if (applied.supplierId) {
        setSupplierId(String(applied.supplierId))
        if (applied.supplierCreated) {
          log.push(`✦ 新建供應商：${applied.supplierName}`)
        }
        // 不論新建或已有，都 refresh 確保清單是最新的
        const r = await fetch('/api/suppliers?limit=500')
        if (r.ok) {
          const d = await r.json() as { suppliers?: Supplier[] } | Supplier[]
          setSuppliers(Array.isArray(d) ? d : (d.suppliers ?? []))
        }
      }

      // 幣別
      if (applied.currency) setCurrencyCode(applied.currency)

      // 原始單據號
      if (applied.invoiceNo) setDocRefNo(applied.invoiceNo)

      // 品項
      if (applied.items.length > 0) {
        const newItems = applied.items.map(it => ({
          productId: String(it.productId),
          quantity:  String(it.qty),
          unitPrice: String(it.unitPrice),
          unit:      it.unit,
          note:      '',
        }))
        setItems(newItems)

        // refresh 產品清單（不論是否新建，確保 ProductPicker 能找到）
        const r = await fetch('/api/products?limit=2000')
        if (r.ok) {
          const d = await r.json() as { products?: Product[] } | Product[]
          setProducts(Array.isArray(d) ? d : (d.products ?? []))
        }

        applied.items.filter(it => it.productCreated).forEach(it => {
          log.push(`✦ 新建產品：${it.productName}${it.sku ? ` (${it.sku})` : ''}`)
        })
      }

      setApplyLog(log)
      setAiMsg({ type: 'ok', text: `解析完成，共 ${applied.items.length} 項。${log.length ? '（已自動建立新資料，見下方）' : ''}` })
      setMode('form')

    } catch (err) {
      setAiMsg({ type: 'err', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setAiParsing(false)
    }
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

  // ── 選擇畫面 ─────────────────────────────────────────────────────────────────
  if (mode === 'choose') {
    return (
      <div className="max-w-2xl">
        <input ref={fileRef} type="file"
          accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.txt"
          className="hidden" onChange={handleAiParse} />

        {aiParsing && (
          <div className="mb-6 bg-purple-50 border border-purple-200 rounded-xl p-6 text-center">
            <p className="text-2xl mb-2">⏳</p>
            <p className="text-purple-700 font-medium">{aiMsg?.text}</p>
          </div>
        )}

        {aiMsg?.type === 'err' && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {aiMsg.text}
            <button onClick={() => setAiMsg(null)} className="ml-2 underline text-xs">關閉</button>
          </div>
        )}

        {!aiParsing && (
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

  // ── 採購單表單 ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">

      {/* AI 結果摘要 */}
      {aiMsg?.type === 'ok' && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          {aiMsg.text}
          {applyLog.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {applyLog.map((l, i) => <li key={i} className="text-purple-700">{l}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* 採購資訊 */}
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-700">採購明細</h2>
          <button type="button" onClick={() => { setMode('choose'); setAiMsg(null) }}
            className="text-xs text-gray-400 hover:text-purple-600">
            ✨ 重新上傳單據
          </button>
        </div>

        {/* 欄標題 */}
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
                {/* 料號 + 規格說明 */}
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
