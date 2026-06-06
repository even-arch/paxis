'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SHIP_VIA, CURRENCIES } from '@/modules/purchase/poUtils'
import ProductPicker from '@/components/ProductPicker'

type Supplier    = { id: number; name: string; shortName: string | null; currencyCode: string | null }
type Product     = { id: number; name: string; sku: string | null; unit: string | null; specification: string | null }
type SalesOrder  = { id: number; orderNo: string; patiscoBuyerName: string | null; customer: { name: string } | null; _count: { items: number } }
type LineItem    = { productId: string; quantity: string; unitPrice: string; unit: string; note: string }

const emptyLine = (): LineItem => ({ productId: '', quantity: '', unitPrice: '', unit: '', note: '' })

export default function PurchaseForm({
  suppliers,
  products,
  salesOrders,
}: {
  suppliers:   Supplier[]
  products:    Product[]
  salesOrders: SalesOrder[]
}) {
  const router = useRouter()

  const [supplierId,    setSupplierId]    = useState('')
  const [sourceType,    setSourceType]    = useState('0')
  const [salesOrderId,  setSalesOrderId]  = useState('')   // 來源客戶訂單 ID
  const [salesOrderNo,  setSalesOrderNo]  = useState('')   // 同步顯示用
  const [poNoOverride,  setPoNoOverride]  = useState('')   // 用戶可自訂後綴（空=沿用銷售單號）
  const [docRefNo,      setDocRefNo]      = useState('')
  const [currencyCode,  setCurrencyCode]  = useState('USD')
  const [exchangeRate,  setExchangeRate]  = useState('')
  const [expectedDate,  setExpectedDate]  = useState('')
  const [port,          setPort]          = useState('')
  const [shipVia,       setShipVia]       = useState('')
  const [note,          setNote]          = useState('')
  const [items,         setItems]         = useState<LineItem[]>([emptyLine()])
  const [error,         setError]         = useState('')
  const [saving,        setSaving]        = useState(false)

  // sourceType 切換到「接單後採購」時，清除已選客戶訂單
  function handleSourceTypeChange(val: string) {
    setSourceType(val)
    if (val !== '1') { setSalesOrderId(''); setSalesOrderNo(''); setPoNoOverride('') }
  }

  // 選擇客戶訂單：同步填入供應商訂單號預設值
  function handleSalesOrderChange(id: string) {
    setSalesOrderId(id)
    const so = salesOrders.find(s => String(s.id) === id)
    setSalesOrderNo(so?.orderNo ?? '')
    setPoNoOverride('')   // 清空覆蓋，預設用原始單號
  }

  // 最終供應商訂單號：poNoOverride 有填用覆蓋值；否則用銷售單號；否則留空讓後端 generatePoNo()
  const finalPoNo = poNoOverride.trim() || salesOrderNo || ''

  function handleSupplierChange(id: string) {
    setSupplierId(id)
    const sup = suppliers.find(s => String(s.id) === id)
    if (sup?.currencyCode) setCurrencyCode(sup.currencyCode)
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

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId) { setError('請選擇供應商'); return }
    if (sourceType === '1' && !salesOrderId) { setError('接單後採購必須選擇來源客戶訂單'); return }
    const valid = items.filter(i => i.productId && i.quantity && i.unitPrice)
    if (!valid.length) { setError('請至少輸入一項採購明細'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/purchases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poNo: finalPoNo || undefined,
        supplierId, sourceType: Number(sourceType),
        salesOrderId: salesOrderId ? Number(salesOrderId) : null,
        currencyCode, exchangeRate: exchangeRate || '1',
        expectedDate, port, shipVia,
        note: [docRefNo ? `單據號：${docRefNo}` : '', note].filter(Boolean).join('\n'),
        items: valid.map(i => ({ productId: Number(i.productId), quantity: Number(i.quantity), unitPrice: i.unitPrice, unit: i.unit, note: i.note })),
      }),
    })
    setSaving(false)
    if (!res.ok) { setError('儲存失敗，請再試一次'); return }
    const d = await res.json()
    router.push(`/purchases/${d.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">採購資訊</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <Field label="採購觸發來源" required>
            <select value={sourceType} onChange={e => handleSourceTypeChange(e.target.value)} className={inp}>
              <option value="0">主動補貨（預測/季節/促銷）</option>
              <option value="1">接單後採購（Made to Order）</option>
              <option value="2">安全庫存觸發（低於警戒線）</option>
            </select>
          </Field>

          {/* 接單後採購：選擇來源客戶訂單 */}
          {sourceType === '1' && (
            <Field label="來源客戶訂單" required>
              <select value={salesOrderId} onChange={e => handleSalesOrderChange(e.target.value)} className={inp} required>
                <option value="">請選擇客戶訂單</option>
                {salesOrders.map(so => (
                  <option key={so.id} value={so.id}>
                    {so.orderNo}
                    {so.customer?.name || so.patiscoBuyerName
                      ? ` — ${so.customer?.name ?? so.patiscoBuyerName}`
                      : ''}
                    {` (${so._count.items} 項)`}
                  </option>
                ))}
              </select>
              {salesOrderNo && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500">
                    供應商訂單號預設為：
                    <span className="font-mono font-medium text-gray-700 ml-1">{finalPoNo}</span>
                    （拆單時請加後綴，如 <span className="font-mono">{salesOrderNo}-1</span>）
                  </p>
                  <input
                    type="text"
                    value={poNoOverride}
                    onChange={e => setPoNoOverride(e.target.value)}
                    className={inp}
                    placeholder={`預設：${salesOrderNo}（需要拆單時手動填入後綴）`}
                  />
                </div>
              )}
            </Field>
          )}

          <Field label="原始單據號">
            <input type="text" value={docRefNo} onChange={e => setDocRefNo(e.target.value)}
              className={inp} placeholder="供應商發票號 / PO 號" />
          </Field>

          <Field label="供應商" required>
            <select value={supplierId} onChange={e => handleSupplierChange(e.target.value)} className={inp} required>
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

          <div className="md:col-span-2">
            <Field label="備註">
              <textarea value={note} onChange={e => setNote(e.target.value)} className={`${inp} h-20`}
                placeholder="付款條件、特殊要求等..." />
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
          {items.map((item, idx) => {
            const spec = products.find(p => String(p.id) === item.productId)?.specification ?? ''
            const sku  = products.find(p => String(p.id) === item.productId)?.sku ?? ''
            return (
              <div key={idx} className="border-b border-gray-50 pb-3">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <ProductPicker products={products} value={item.productId}
                      onChange={(id, unit) => setItems(prev => prev.map((it, i) =>
                        i === idx ? { ...it, productId: id, unit: unit || it.unit } : it))} />
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
          <span className="text-sm text-gray-500">總金額：</span>
          <span className="text-lg font-semibold text-gray-800 ml-2">{currencyCode} {subtotal.toFixed(2)}</span>
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
