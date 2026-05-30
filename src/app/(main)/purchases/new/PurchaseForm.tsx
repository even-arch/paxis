'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SHIP_VIA, CURRENCIES } from '@/modules/purchase/poUtils'
import type { ParsedInvoice } from '@/app/api/ai/parse-invoice/route'

type Supplier = { id: number; name: string; shortName: string | null; currencyCode: string | null }
type Product = { id: number; name: string; sku: string | null; unit: string | null }
type LineItem = { productId: string; quantity: string; unitPrice: string; unit: string; note: string }

const emptyLine = (): LineItem => ({ productId: '', quantity: '', unitPrice: '', unit: '', note: '' })

export default function PurchaseForm({ suppliers, products }: { suppliers: Supplier[]; products: Product[] }) {
  const router = useRouter()
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

  // AI 解析
  const fileRef = useRef<HTMLInputElement>(null)
  const [aiParsing, setAiParsing] = useState(false)
  const [aiMsg, setAiMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null)
  const [parsedPreview, setParsedPreview] = useState<ParsedInvoice | null>(null)

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
    setAiMsg({ type: 'info', text: `AI 解析中：${file.name}…` })
    setParsedPreview(null)

    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/ai/parse-invoice', { method: 'POST', body: fd })
    setAiParsing(false)
    e.target.value = ''   // 允許重新上傳同一檔

    if (!res.ok) {
      const d = await res.json()
      setAiMsg({ type: 'err', text: d.error ?? 'AI 解析失敗' })
      return
    }

    const { data } = await res.json() as { data: ParsedInvoice }
    setParsedPreview(data)
    setAiMsg({ type: 'ok', text: '解析完成，請確認後套用' })
  }

  function applyParsed() {
    if (!parsedPreview) return

    // 帶入供應商（模糊比對）
    if (parsedPreview.supplierName) {
      const name = parsedPreview.supplierName.toLowerCase()
      const match = suppliers.find(s =>
        s.name.toLowerCase().includes(name) || name.includes(s.name.toLowerCase())
      )
      if (match) setSupplierId(String(match.id))
    }

    // 帶入幣別
    if (parsedPreview.currency) setCurrencyCode(parsedPreview.currency)

    // 帶入備註（發票號）
    if (parsedPreview.invoiceNo) setNote(prev =>
      prev ? prev : `Ref: ${parsedPreview!.invoiceNo}`
    )

    // 帶入明細（商品描述模糊比對）
    const validItems = parsedPreview.items.filter(pi => pi && (pi.description || pi.sku))
    if (validItems.length > 0) {
      const newLines: LineItem[] = validItems.map(pi => {
        const desc = (pi.description ?? '').toLowerCase()
        const matched = products.find(p =>
          (desc && (p.name.toLowerCase().includes(desc) || desc.includes(p.name.toLowerCase()))) ||
          (p.sku && pi.sku && p.sku.toLowerCase() === pi.sku.toLowerCase())
        )
        return {
          productId: matched ? String(matched.id) : '',
          quantity: String(pi.qty),
          unitPrice: String(pi.unitPrice),
          unit: pi.unit ?? matched?.unit ?? 'PCS',
          note: matched ? '' : pi.description,  // 未比對到的保留原始描述
        }
      })
      setItems(newLines)
    }

    setParsedPreview(null)
    setAiMsg({ type: 'ok', text: '已套用。未能自動比對的商品欄位以空白顯示，請手動選擇。' })
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
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv,.txt"
              className="hidden" onChange={handleAiParse} />
            <button type="button" disabled={aiParsing}
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-sm border border-purple-300 text-purple-700 bg-purple-50 px-3 py-1.5 rounded-md hover:bg-purple-100 disabled:opacity-50">
              <span>{aiParsing ? '⏳' : '✨'}</span>
              <span>{aiParsing ? 'AI 解析中…' : 'AI 解析發票/採購單'}</span>
            </button>
          </div>
        </div>

        {/* AI 訊息 */}
        {aiMsg && (
          <div className={`mb-4 p-3 rounded-md text-sm ${
            aiMsg.type === 'ok' ? 'bg-green-50 text-green-700' :
            aiMsg.type === 'err' ? 'bg-red-50 text-red-700' :
            'bg-blue-50 text-blue-700'
          }`}>
            {aiMsg.text}
          </div>
        )}

        {/* AI 解析預覽 */}
        {parsedPreview && (
          <div className="mb-4 border border-purple-200 rounded-lg p-4 bg-purple-50 space-y-2">
            <p className="text-sm font-medium text-purple-800">AI 解析結果預覽</p>
            {parsedPreview.supplierName && (
              <p className="text-xs text-purple-700">供應商：{parsedPreview.supplierName}</p>
            )}
            {parsedPreview.invoiceNo && (
              <p className="text-xs text-purple-700">單號：{parsedPreview.invoiceNo}</p>
            )}
            {parsedPreview.currency && (
              <p className="text-xs text-purple-700">幣別：{parsedPreview.currency}</p>
            )}
            <table className="w-full text-xs mt-2">
              <thead>
                <tr className="text-purple-600 border-b border-purple-200">
                  <th className="text-left pb-1">品名</th>
                  <th className="text-right pb-1">數量</th>
                  <th className="text-right pb-1">單價</th>
                </tr>
              </thead>
              <tbody>
                {parsedPreview.items.filter(it => it).map((it, i) => (
                  <tr key={i} className="border-b border-purple-100">
                    <td className="py-0.5">{it.description ?? '—'}{it.sku ? ` (${it.sku})` : ''}</td>
                    <td className="text-right py-0.5">{it.qty ?? 0} {it.unit ?? ''}</td>
                    <td className="text-right py-0.5">{it.unitPrice ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={applyParsed}
                className="text-sm bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700">
                套用到表單
              </button>
              <button type="button" onClick={() => { setParsedPreview(null); setAiMsg(null) }}
                className="text-sm border border-purple-300 text-purple-600 px-3 py-1 rounded hover:bg-purple-100">
                捨棄
              </button>
            </div>
          </div>
        )}
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end border-b border-gray-50 pb-3">
              <div className="col-span-4">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">商品</label>}
                <select value={item.productId} onChange={e => setItem(idx, 'productId', e.target.value)} className={inp}>
                  <option value="">請選擇商品</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                  ))}
                </select>
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
