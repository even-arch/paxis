'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SHIP_VIA, CURRENCIES } from '@/modules/purchase/poUtils'
import type { ParsedInvoice } from '@/app/api/ai/parse-invoice/route'
import type { AppliedInvoice } from '@/app/api/ai/apply-invoice/route'
import ProductPicker from '@/components/ProductPicker'

type Supplier = { id: number; name: string; shortName: string | null; currencyCode: string | null }
type Product = { id: number; name: string; sku: string | null; unit: string | null }
type LineItem = { productId: string; quantity: string; unitPrice: string; unit: string; note: string }

const emptyLine = (): LineItem => ({ productId: '', quantity: '', unitPrice: '', unit: '', note: '' })

export default function PurchaseForm({ suppliers: initSuppliers, products: initProducts }: { suppliers: Supplier[]; products: Product[] }) {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState(initSuppliers)
  const [products, setProducts] = useState(initProducts)
  const [supplierId, setSupplierId] = useState('')
  const [sourceType, setSourceType] = useState('0')
  const [currencyCode, setCurrencyCode] = useState('USD')
  const [exchangeRate, setExchangeRate] = useState('1')
  const [expectedDate, setExpectedDate] = useState('')
  const [port, setPort] = useState('')
  const [shipVia, setShipVia] = useState('')
  const [patiscoOrderNo, setPatiscoOrderNo] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<LineItem[]>([emptyLine()])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // 進入模式：'choose' = 選擇方式, 'form' = 顯示表單
  const [mode, setMode] = useState<'choose' | 'form'>('choose')

  // AI 解析
  const fileRef = useRef<HTMLInputElement>(null)
  const [aiParsing, setAiParsing] = useState(false)
  const [aiMsg, setAiMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null)
  const [parsedPreview, setParsedPreview] = useState<ParsedInvoice | null>(null)
  const [applyLog, setApplyLog] = useState<string[]>([])

  function handleSupplierChange(id: string) {
    setSupplierId(id)
    const sup = suppliers.find(s => String(s.id) === id)
    if (sup?.currencyCode) setCurrencyCode(sup.currencyCode)
  }

  function setItem(idx: number, field: keyof LineItem, value: string) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
    // 自動帶入商品單位
    if (field === 'productId') {
      const p = products.find(p => String(p.id) === value)
      if (p?.unit) setItems(prev => prev.map((item, i) => i === idx ? { ...item, unit: p.unit ?? '' } : item))
    }
  }

  function addLine() { setItems(prev => [...prev, emptyLine()]) }
  function removeLine(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }

  async function handleAiParse(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAiParsing(true)
    setAiMsg({ type: 'info', text: `步驟 1/2：AI 解析中：${file.name}…` })
    setParsedPreview(null)
    setApplyLog([])
    e.target.value = ''

    try {
      // Step 1: parse file
      const fd = new FormData()
      fd.append('file', file)
      const parseRes = await fetch('/api/ai/parse-invoice', { method: 'POST', body: fd })
      const parseData = await parseRes.json() as { data?: ParsedInvoice; error?: string }
      if (!parseRes.ok) throw new Error(parseData.error ?? '解析失敗')

      setAiMsg({ type: 'info', text: '步驟 2/2：自動建立供應商與產品…' })

      // Step 2: apply (auto-create missing supplier/products)
      const applyRes = await fetch('/api/ai/apply-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseData.data),
      })
      const applyData = await applyRes.json() as { data?: AppliedInvoice; error?: string }
      if (!applyRes.ok) throw new Error(applyData.error ?? '建立失敗')

      const applied = applyData.data!
      const log: string[] = []

      // Fill supplier
      if (applied.supplierId) {
        setSupplierId(String(applied.supplierId))
        if (applied.supplierCreated) {
          log.push(`✦ 新建供應商：${applied.supplierName}`)
          // refresh suppliers list
          const r = await fetch('/api/suppliers')
          if (r.ok) setSuppliers(await r.json() as Supplier[])
        }
      }

      // Fill currency
      if (applied.currency) setCurrencyCode(applied.currency)

      // Fill note
      if (applied.invoiceNo) setNote(prev => prev || `Ref: ${applied.invoiceNo}`)

      // Fill line items
      if (applied.items.length > 0) {
        setItems(applied.items.map(it => ({
          productId: String(it.productId),
          quantity: String(it.qty),
          unitPrice: String(it.unitPrice),
          unit: it.unit,
          note: '',
        })))
        // refresh products list if any were created
        if (applied.items.some(it => it.productCreated)) {
          const r = await fetch('/api/products')
          if (r.ok) setProducts(await r.json() as Product[])
          applied.items.filter(it => it.productCreated).forEach(it => {
            log.push(`✦ 新建產品：${it.productName}${it.sku ? ` (${it.sku})` : ''}`)
          })
        }
      }

      setApplyLog(log)
      setAiMsg({ type: 'ok', text: `解析完成，共 ${applied.items.length} 項。${log.length > 0 ? '（已自動建立新供應商/產品）' : ''}` })
      setMode('form')

    } catch (err) {
      setAiMsg({ type: 'err', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setAiParsing(false)
    }
  }

  const subtotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unitPrice) || 0
    return sum + qty * price
  }, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId) { setError('請選擇供應商'); return }
    const validItems = items.filter(i => i.productId && i.quantity && i.unitPrice)
    if (validItems.length === 0) { setError('請至少輸入一項採購明細'); return }

    setSaving(true)
    setError('')

    const res = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId, sourceType: Number(sourceType), currencyCode, exchangeRate,
        expectedDate, port, shipVia, patiscoOrderNo, note,
        items: validItems.map(i => ({
          productId: Number(i.productId),
          quantity: Number(i.quantity),
          unitPrice: i.unitPrice,
          unit: i.unit,
          note: i.note,
        })),
      }),
    })

    setSaving(false)
    if (!res.ok) { setError('儲存失敗，請再試一次'); return }
    const data = await res.json()
    router.push(`/purchases/${data.id}`)
    router.refresh()
  }

  // 選擇進入方式的畫面
  if (mode === 'choose') {
    return (
      <div className="max-w-2xl">
        <input ref={fileRef} type="file"
          accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.txt"
          className="hidden" onChange={handleAiParse} />

        {/* AI 解析中的覆蓋層 */}
        {aiParsing && (
          <div className="mb-6 bg-purple-50 border border-purple-200 rounded-xl p-6 text-center">
            <p className="text-2xl mb-2">⏳</p>
            <p className="text-purple-700 font-medium">{aiMsg?.text}</p>
          </div>
        )}

        {/* 錯誤訊息 */}
        {aiMsg?.type === 'err' && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {aiMsg.text}
            <button onClick={() => setAiMsg(null)} className="ml-2 underline text-xs">關閉</button>
          </div>
        )}

        {!aiParsing && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AI 自動填寫（主要路徑） */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group flex flex-col items-center justify-center gap-3 bg-white border-2 border-purple-300 rounded-xl p-8 hover:border-purple-500 hover:bg-purple-50 transition-all text-center"
            >
              <span className="text-4xl">✨</span>
              <div>
                <p className="font-semibold text-gray-800 text-base">上傳單據，AI 自動填寫</p>
                <p className="text-xs text-gray-500 mt-1">支援 PDF、Excel、圖片</p>
                <p className="text-xs text-purple-600 mt-2">AI 自動識別供應商、產品、數量、單價</p>
              </div>
            </button>

            {/* 手動輸入（次要路徑） */}
            <button
              type="button"
              onClick={() => setMode('form')}
              className="flex flex-col items-center justify-center gap-3 bg-white border-2 border-gray-200 rounded-xl p-8 hover:border-gray-400 hover:bg-gray-50 transition-all text-center"
            >
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* 標頭 */}
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
          <div className="md:col-span-2">
            <Field label="Patisco 訂單號（溯源用）">
              <input type="text" value={patiscoOrderNo} onChange={e => setPatiscoOrderNo(e.target.value)}
                className={inp} placeholder="例：ORD-20240530-0001（從 Patisco 複製）" />
            </Field>
            <p className="text-xs text-gray-400 mt-1">此採購單對應的 Patisco 訂單，方便後續追蹤</p>
          </div>
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
          <Field label="匯率（對 TWD）">
            <input type="number" step="0.000001" value={exchangeRate}
              onChange={e => setExchangeRate(e.target.value)} className={inp} />
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

        {/* AI 結果 */}
        {aiMsg?.type === 'ok' && (
          <div className="mb-4 p-3 rounded-md text-sm bg-green-50 text-green-700">{aiMsg.text}</div>
        )}
        {applyLog.length > 0 && (
          <div className="mb-4 border border-purple-200 rounded-lg p-3 bg-purple-50">
            <p className="text-xs font-medium text-purple-700 mb-1">自動建立的資料：</p>
            {applyLog.map((l, i) => (
              <p key={i} className="text-xs text-purple-600">{l}</p>
            ))}
          </div>
        )}
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end border-b border-gray-50 pb-3">
              <div className="col-span-4">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">商品</label>}
                <ProductPicker
                  products={products}
                  value={item.productId}
                  onChange={(id, unit) => {
                    setItems(prev => prev.map((it, i) => i === idx
                      ? { ...it, productId: id, unit: unit || it.unit }
                      : it
                    ))
                  }}
                />
              </div>
              <div className="col-span-2">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">數量</label>}
                <input type="number" min="1" value={item.quantity}
                  onChange={e => setItem(idx, 'quantity', e.target.value)} className={inp} placeholder="0" />
              </div>
              <div className="col-span-1">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">單位</label>}
                <input type="text" value={item.unit}
                  onChange={e => setItem(idx, 'unit', e.target.value)} className={inp} />
              </div>
              <div className="col-span-2">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">單價 ({currencyCode})</label>}
                <input type="number" step="0.0001" value={item.unitPrice}
                  onChange={e => setItem(idx, 'unitPrice', e.target.value)} className={inp} placeholder="0.00" />
              </div>
              <div className="col-span-2">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">小計</label>}
                <div className="px-3 py-2 text-sm text-gray-500 text-right">
                  {((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}
                </div>
              </div>
              <div className="col-span-1 flex justify-end">
                {items.length > 1 && (
                  <button type="button" onClick={() => removeLine(idx)}
                    className="text-red-400 hover:text-red-600 text-lg leading-none pb-2">×</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={addLine}
          className="mt-3 text-sm text-blue-600 hover:underline">
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
