'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { ParsedCustomerOrder } from '@/app/api/ai/parse-customer-order/route'
import type { AppliedProduct } from '@/app/api/ai/apply-products/route'
import type { AppliedCustomer } from '@/app/api/ai/apply-customer/route'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'TWD', 'HKD']

type DbCustomer = {
  id: number; name: string; shortName: string | null; currencyCode: string | null
  email: string | null; phoneNo: string | null; paymentTerms: string | null
  city: string | null; countryCode: string | null
}
type DbProduct = { id: number; name: string; sku: string | null; unit: string | null; specification: string | null }

type ProductDraft = {
  name: string; specification: string; sku: string
  qty: string; unitPrice: string; unit: string
  conflictId: number | null; conflictName: string; conflictSpec: string
  hasDiff: boolean; action: 'create' | 'use-existing'
}
type CustomerDraft = {
  name: string; shortName: string; email: string; phone: string
  address: string; city: string; country: string
  contactPerson: string; paymentTerms: string; currencyCode: string
  matchedId: number | null; matchedCustomer: DbCustomer | null
}

type SavedProduct = { productId: number; productName: string; sku: string | null; qty: number; unitPrice: number; unit: string; isNew: boolean }
type SavedCustomer = { customerId: number; customerName: string; isNew: boolean }

type Mode = 'upload' | 'products' | 'customer' | 'order' | 'success'

export default function SalesImportWizard({
  customers: initCustomers,
  products: initProducts,
}: {
  customers: DbCustomer[]
  products: DbProduct[]
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('upload')

  const [productDrafts, setProductDrafts] = useState<ProductDraft[]>([])
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>({
    name: '', shortName: '', email: '', phone: '', address: '', city: '', country: '',
    contactPerson: '', paymentTerms: '', currencyCode: 'USD',
    matchedId: null, matchedCustomer: null,
  })

  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([])
  const [savedCustomer, setSavedCustomer] = useState<SavedCustomer | null>(null)

  // 訂單欄位
  const [orderRefNo, setOrderRefNo] = useState('')
  const [currencyCode, setCurrencyCode] = useState('USD')
  const [exchangeRate, setExchangeRate] = useState('')
  const [requestedShipDate, setRequestedShipDate] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [note, setNote] = useState('')
  const [orderItems, setOrderItems] = useState<{
    productId: number; productName: string; sku: string | null; qty: string; unitPrice: string; unit: string
  }[]>([])

  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null)
  const [creatingPi, setCreatingPi] = useState(false)
  const [createdPiNo, setCreatedPiNo] = useState<string | null>(null)
  const [piError, setPiError] = useState('')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const stepLabels = ['上傳訂單', '確認產品', '確認客戶', '建立銷售訂單']
  const stepIdx = ({ upload: 0, products: 1, customer: 2, order: 3, success: 3 } as Record<Mode, number>)[mode]

  // ─── 步驟 0：上傳 & AI 解析 ─────────────────────────────────────────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true); setError('')
    e.target.value = ''
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/ai/parse-customer-order', { method: 'POST', body: fd })
      const json = await res.json() as { data?: ParsedCustomerOrder; error?: string }
      if (!res.ok) throw new Error(json.error ?? `解析失敗 (HTTP ${res.status})`)
      const ord = json.data!

      // 本地 SKU 衝突偵測
      const drafts: ProductDraft[] = (ord.items ?? []).map(it => {
        const sku = it.sku?.trim() ?? ''
        const ex = sku ? initProducts.find(p => p.sku && p.sku.toLowerCase() === sku.toLowerCase()) : undefined
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

      // 本地客戶比對
      const cusName = ord.customerName?.trim() ?? ''
      const matched = cusName
        ? initCustomers.find(c =>
            c.name.toLowerCase() === cusName.toLowerCase() ||
            (c.shortName && c.shortName.toLowerCase() === cusName.toLowerCase()))
        : undefined

      setCustomerDraft({
        name: cusName, shortName: '', email: ord.customerEmail?.trim() ?? '',
        phone: ord.customerPhone?.trim() ?? '',
        address: ord.customerAddress?.trim() ?? '',
        city: ord.customerCity?.trim() ?? '',
        country: ord.customerCountry?.trim() ?? '',
        contactPerson: '', paymentTerms: ord.paymentTerms?.trim() ?? '',
        currencyCode: ord.currency ?? 'USD',
        matchedId: matched?.id ?? null, matchedCustomer: matched ?? null,
      })

      if (ord.orderNo) setOrderRefNo(ord.orderNo)
      if (ord.currency) setCurrencyCode(ord.currency)
      if (ord.requestedShipDate) setRequestedShipDate(ord.requestedShipDate)
      if (ord.paymentTerms) setPaymentTerms(ord.paymentTerms)

      setMode('products')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  // ─── 步驟 1：確認產品 → 立即寫入 DB ────────────────────────────────────────
  async function saveProducts() {
    const unidentifiable = productDrafts.filter(d => !d.sku.trim() && !d.specification.trim())
    if (unidentifiable.length > 0) {
      setError(`有 ${unidentifiable.length} 項商品既無料號（SKU）也無規格說明，無法識別，請確認文件內容或改用手動建立。`)
      return
    }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/ai/apply-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: productDrafts.map(d => ({
            name: d.name,
            specification: d.specification || null,
            sku: d.sku || null,
            qty: Number(d.qty),
            unitPrice: Number(d.unitPrice),
            unit: d.unit,
          })),
        }),
      })
      const json = await res.json() as { data?: AppliedProduct[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? `寫入失敗 (HTTP ${res.status})`)

      const applied = json.data!
      const saved: SavedProduct[] = applied.map(ap => ({
        productId: ap.productId, productName: ap.productName, sku: ap.sku,
        qty: ap.qty, unitPrice: ap.unitPrice, unit: ap.unit, isNew: ap.productCreated,
      }))
      setSavedProducts(saved)

      setOrderItems(saved.map(s => ({
        productId: s.productId, productName: s.productName, sku: s.sku,
        qty: String(s.qty), unitPrice: String(s.unitPrice), unit: s.unit,
      })))

      setMode('customer')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  // ─── 步驟 2：確認客戶 → 立即寫入 DB（或使用現有）──────────────────────────
  async function saveCustomer() {
    if (!customerDraft.name.trim()) { setError('請填入客戶名稱'); return }
    setLoading(true); setError('')
    try {
      let customerId: number
      let customerName: string
      let isNew = false

      // 永遠呼叫 API，避免本地快取的 id 過期
      const res = await fetch('/api/ai/apply-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerDraft.name,
          customerShortName: customerDraft.shortName || null,
          customerEmail: customerDraft.email || null,
          customerPhone: customerDraft.phone || null,
          customerAddress: customerDraft.address || null,
          customerCity: customerDraft.city || null,
          customerCountry: customerDraft.country || null,
          contactPerson: customerDraft.contactPerson || null,
          paymentTerms: customerDraft.paymentTerms || null,
          currencyCode: customerDraft.currencyCode || null,
        }),
      })
      const json = await res.json() as { data?: AppliedCustomer; error?: string }
      if (!res.ok) throw new Error(json.error ?? `寫入失敗 (HTTP ${res.status})`)
      customerId = json.data!.customerId
      customerName = json.data!.customerName
      isNew = json.data!.customerCreated

      setSavedCustomer({ customerId, customerName, isNew })
      setMode('order')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  // ─── 步驟 3：建立銷售訂單 ───────────────────────────────────────────────────
  async function submitOrder(e: React.FormEvent) {
    e.preventDefault()
    if (!savedCustomer) { setError('客戶尚未確認'); return }
    if (!orderItems.length) { setError('至少需要一項產品'); return }

    setSaving(true); setError('')
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: savedCustomer.customerId,
          orderNo: orderRefNo || undefined,
          currencyCode,
          exchangeRate: exchangeRate || '1',
          customerRequestedShipDate: requestedShipDate || null,
          note: [paymentTerms ? `付款條件：${paymentTerms}` : '', note].filter(Boolean).join('\n') || null,
          source: 'AI_IMPORT',
          items: orderItems.map(i => ({
            productId: i.productId,
            quantity: Number(i.qty),
            unitPrice: i.unitPrice,
            unit: i.unit,
          })),
        }),
      })
      const json = await res.json() as { id?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? `建立失敗 (HTTP ${res.status})`)
      setCreatedOrderId(json.id!)
      setMode('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  // ─── 步驟 3 完成後：選擇性建立 PI ──────────────────────────────────────────
  async function handleCreatePi() {
    if (!createdOrderId) return
    setCreatingPi(true); setPiError('')
    try {
      // 先取訂單品項（含 slsItemId）
      const orderRes = await fetch(`/api/sales/${createdOrderId}`)
      const orderData = await orderRes.json()
      if (!orderRes.ok) throw new Error(orderData.error ?? '無法取得訂單資料')
      const items = (orderData.items ?? []).map((it: { id: number; quantity: number }) => ({
        slsItemId: it.id,
        quantity: it.quantity,
      }))
      if (!items.length) throw new Error('訂單無品項')

      const piRes = await fetch(`/api/sales/${createdOrderId}/pi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const piData = await piRes.json()
      if (!piRes.ok) throw new Error(piData.error ?? 'PI 建立失敗')
      setCreatedPiNo(piData.piNo)
    } catch (err) {
      setPiError(err instanceof Error ? err.message : 'PI 建立失敗')
    } finally {
      setCreatingPi(false)
    }
  }

  // ─── 共用 UI ─────────────────────────────────────────────────────────────────
  const StepBar = () => (
    <div className="flex items-center gap-0 mb-6">
      {stepLabels.map((s, i) => (
        <div key={i} className="flex items-center">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${i < stepIdx ? 'text-green-600' : i === stepIdx ? 'text-blue-600' : 'text-gray-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs border ${
              i < stepIdx  ? 'bg-green-100 border-green-400 text-green-700' :
              i === stepIdx ? 'bg-blue-100 border-blue-400 text-blue-700' :
                             'bg-gray-100 border-gray-300 text-gray-400'}`}>
              {i < stepIdx ? '✓' : i + 1}
            </span>
            {s}
          </div>
          {i < stepLabels.length - 1 && <div className={`mx-2 h-px w-8 ${i < stepIdx ? 'bg-green-300' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )

  const ErrBar = () => !error ? null : (
    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4 flex justify-between">
      <span>{error}</span>
      <button onClick={() => setError('')} className="underline text-xs ml-4 shrink-0">關閉</button>
    </div>
  )

  // ══ 步驟 0：上傳 ══
  if (mode === 'upload') {
    return (
      <div className="max-w-2xl">
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.txt" className="hidden" onChange={handleFile} />
        <ErrBar />
        {loading ? (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">⏳</div>
            <p className="text-teal-700 font-medium">AI 解析客戶訂單中，請稍候…</p>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-full flex flex-col items-center gap-4 bg-white border-2 border-dashed border-teal-300 rounded-xl p-12 hover:border-teal-500 hover:bg-teal-50 transition-all text-center">
            <span className="text-5xl">📋</span>
            <div>
              <p className="font-semibold text-gray-800 text-lg">點擊上傳客戶訂單文件</p>
              <p className="text-sm text-gray-500 mt-1">支援 PDF、Excel、圖片（JPG / PNG）</p>
              <p className="text-xs text-teal-600 mt-3">AI 自動識別客戶資訊與訂購品項，逐步確認後建立銷售訂單</p>
            </div>
          </button>
        )}
      </div>
    )
  }

  // ══ 步驟 1：確認產品 ══
  if (mode === 'products') {
    return (
      <div className="max-w-5xl space-y-4">
        <StepBar />
        <ErrBar />
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">步驟 1：確認產品資料</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              確認後按「存入產品資料庫」立即寫入。<span className="text-amber-600">⚠ 黃底 = 料號已存在但資料有差異。</span>
            </p>
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
                          onClick={() => setProductDrafts(p => p.map((d, i) => i === idx ? { ...d, action: 'use-existing' } : d))}
                          className={`px-3 py-1.5 rounded text-xs font-medium ${item.action === 'use-existing' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>
                          使用現有
                        </button>
                        <button type="button"
                          onClick={() => setProductDrafts(p => p.map((d, i) => i === idx ? { ...d, action: 'create', sku: '' } : d))}
                          className={`px-3 py-1.5 rounded text-xs font-medium ${item.action === 'create' ? 'bg-orange-500 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>
                          建新產品
                        </button>
                      </div>
                    </div>
                  )}
                  {isMatched && <p className="text-xs text-green-600 mb-2">✓ 料號「{item.sku}」已存在且資料一致，將沿用現有產品。</p>}
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-3">
                      <label className="text-xs text-gray-500 mb-0.5 block">商品名稱</label>
                      <input type="text" value={item.name}
                        onChange={e => setProductDrafts(p => p.map((d, i) => i === idx ? { ...d, name: e.target.value } : d))}
                        className={inp} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 mb-0.5 block">
                        料號 <span className="text-red-500">*</span>
                      </label>
                      <input type="text" value={item.sku}
                        onChange={e => setProductDrafts(p => p.map((d, i) => i === idx ? { ...d, sku: e.target.value } : d))}
                        className={`${inp} font-mono text-xs ${!item.sku.trim() && !item.specification.trim() ? 'border-red-400 bg-red-50' : ''}`}
                        placeholder="建議填入" />
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs text-gray-500 mb-0.5 block">規格說明</label>
                      <input type="text" value={item.specification}
                        onChange={e => setProductDrafts(p => p.map((d, i) => i === idx ? { ...d, specification: e.target.value } : d))}
                        className={inp} />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-500 mb-0.5 block">數量</label>
                      <input type="number" value={item.qty}
                        onChange={e => setProductDrafts(p => p.map((d, i) => i === idx ? { ...d, qty: e.target.value } : d))}
                        className={`${inp} text-right`} />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-500 mb-0.5 block">單位</label>
                      <input type="text" value={item.unit}
                        onChange={e => setProductDrafts(p => p.map((d, i) => i === idx ? { ...d, unit: e.target.value } : d))}
                        className={inp} />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-500 mb-0.5 block">單價</label>
                      <input type="number" step="0.0001" value={item.unitPrice}
                        onChange={e => setProductDrafts(p => p.map((d, i) => i === idx ? { ...d, unitPrice: e.target.value } : d))}
                        className={`${inp} text-right`} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
            <button type="button" onClick={() => { setMode('upload'); setError('') }} className="text-sm text-gray-400 hover:text-gray-600">← 重新上傳</button>
            <button type="button" onClick={saveProducts} disabled={loading}
              className="bg-green-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {loading ? '寫入中…' : '✓ 確認，存入產品資料庫'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══ 步驟 2：確認客戶 ══
  if (mode === 'customer') {
    const mc = customerDraft.matchedCustomer
    return (
      <div className="max-w-2xl space-y-4">
        <StepBar />
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          ✓ 已寫入 {savedProducts.filter(s => s.isNew).length} 筆新產品，{savedProducts.filter(s => !s.isNew).length} 筆沿用現有。
        </div>
        <ErrBar />
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">步驟 2：確認客戶</h2>
          <p className="text-xs text-gray-500 mb-5">確認後按「存入客戶資料庫」，系統立即寫入。</p>

          {mc && (
            <div className="mb-5 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-700 mb-2">系統找到現有客戶「{mc.name}」，請確認是否為同一家：</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                {mc.shortName    && <div><span className="text-gray-400">簡稱：</span>{mc.shortName}</div>}
                {mc.email        && <div><span className="text-gray-400">Email：</span>{mc.email}</div>}
                {mc.phoneNo      && <div><span className="text-gray-400">電話：</span>{mc.phoneNo}</div>}
                {mc.paymentTerms && <div><span className="text-gray-400">付款：</span>{mc.paymentTerms}</div>}
                {mc.currencyCode && <div><span className="text-gray-400">幣別：</span>{mc.currencyCode}</div>}
                {(mc.city || mc.countryCode) && (
                  <div className="col-span-2"><span className="text-gray-400">地點：</span>{[mc.city, mc.countryCode].filter(Boolean).join(', ')}</div>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => setCustomerDraft(d => ({ ...d, matchedId: mc.id, matchedCustomer: mc }))}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${customerDraft.matchedId === mc.id ? 'bg-blue-600 text-white' : 'bg-white border border-blue-300 text-blue-700'}`}>
                  ✓ 是，使用此客戶
                </button>
                <button type="button"
                  onClick={() => setCustomerDraft(d => ({ ...d, matchedId: null, matchedCustomer: null }))}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${!customerDraft.matchedId ? 'bg-orange-500 text-white' : 'bg-white border border-gray-300 text-gray-600'}`}>
                  不是，建立新客戶
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="客戶全名" required>
              <input type="text" value={customerDraft.name}
                onChange={e => setCustomerDraft(d => ({ ...d, name: e.target.value }))} className={inp} />
            </Field>
            <Field label="簡稱">
              <input type="text" value={customerDraft.shortName}
                onChange={e => setCustomerDraft(d => ({ ...d, shortName: e.target.value }))} className={inp} />
            </Field>
            <Field label="Email">
              <input type="email" value={customerDraft.email}
                onChange={e => setCustomerDraft(d => ({ ...d, email: e.target.value }))} className={inp} />
            </Field>
            <Field label="電話">
              <input type="text" value={customerDraft.phone}
                onChange={e => setCustomerDraft(d => ({ ...d, phone: e.target.value }))} className={inp} />
            </Field>
            <Field label="城市">
              <input type="text" value={customerDraft.city}
                onChange={e => setCustomerDraft(d => ({ ...d, city: e.target.value }))} className={inp} />
            </Field>
            <Field label="國家">
              <input type="text" value={customerDraft.country}
                onChange={e => setCustomerDraft(d => ({ ...d, country: e.target.value }))} className={inp} placeholder="US / TW" />
            </Field>
            <div className="col-span-2">
              <Field label="地址">
                <input type="text" value={customerDraft.address}
                  onChange={e => setCustomerDraft(d => ({ ...d, address: e.target.value }))} className={inp} />
              </Field>
            </div>
            <Field label="慣用幣別">
              <select value={customerDraft.currencyCode}
                onChange={e => { setCustomerDraft(d => ({ ...d, currencyCode: e.target.value })); setCurrencyCode(e.target.value) }}
                className={inp}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="付款條件">
              <input type="text" value={customerDraft.paymentTerms}
                onChange={e => setCustomerDraft(d => ({ ...d, paymentTerms: e.target.value }))} className={inp} placeholder="T/T 30 days" />
            </Field>
          </div>

          <div className="flex justify-between mt-6">
            <button type="button" onClick={() => { setError(''); setMode('products') }}
              className="text-sm text-gray-400 hover:text-gray-600">← 上一步</button>
            <button type="button" onClick={saveCustomer} disabled={loading}
              className="bg-green-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {loading ? '寫入中…' : customerDraft.matchedId ? '✓ 確認，使用現有客戶' : '✓ 確認，新增至客戶資料庫'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══ 完成畫面 ══
  if (mode === 'success' && createdOrderId) {
    return (
      <div className="max-w-lg space-y-5">
        <div className="bg-green-50 border border-green-300 rounded-xl p-6 text-center space-y-2">
          <div className="text-4xl">✅</div>
          <h2 className="text-lg font-semibold text-green-800">銷售訂單已建立</h2>
          <p className="text-sm text-gray-600">
            訂單號：<span className="font-mono font-bold">{orderRefNo || `#${createdOrderId}`}</span>
          </p>
        </div>

        {!createdPiNo ? (
          <div className="bg-white rounded-xl border p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">同時建立 PI 給客戶？</h3>
            <p className="text-xs text-gray-500">
              PI 將包含全部訂單品項，並自動預留庫存（reservedQty++）。
              若稍後再建立，請到訂單頁面操作。
            </p>
            {piError && (
              <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-1.5">❌ {piError}</p>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={handleCreatePi} disabled={creatingPi}
                className="flex-1 bg-teal-600 text-white py-2 rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                {creatingPi ? '建立中…' : '✓ 是，建立 PI'}
              </button>
              <button type="button"
                onClick={() => { router.push(`/sales/${createdOrderId}`); router.refresh() }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md text-sm hover:bg-gray-50">
                稍後再建立，前往訂單
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 space-y-2">
            <p className="text-sm font-semibold text-teal-800">✓ PI 已建立</p>
            <p className="text-xs text-gray-600">PI 號：<span className="font-mono font-bold">{createdPiNo}</span></p>
            <p className="text-xs text-gray-500">庫存已預留（reservedQty++）</p>
            <button type="button"
              onClick={() => { router.push(`/sales/${createdOrderId}`); router.refresh() }}
              className="mt-2 text-teal-700 text-sm underline">→ 前往訂單</button>
          </div>
        )}
      </div>
    )
  }

  // ══ 步驟 3：建立銷售訂單 ══
  const subtotal = orderItems.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.unitPrice) || 0), 0)

  return (
    <form onSubmit={submitOrder} className="space-y-6 max-w-4xl">
      <StepBar />

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          ✓ 產品已存入資料庫：{savedProducts.length} 項（{savedProducts.filter(s => s.isNew).length} 筆新建）
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          ✓ 客戶已確認：{savedCustomer?.customerName}{savedCustomer?.isNew ? '（新建）' : '（現有）'}
        </div>
      </div>

      <ErrBar />

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">銷售訂單資料</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">客戶</label>
            <div className={`${inp} bg-gray-50 text-gray-700`}>{savedCustomer?.customerName}</div>
          </div>
          <Field label="客戶訂單號">
            <input type="text" value={orderRefNo} onChange={e => setOrderRefNo(e.target.value)}
              className={inp} placeholder="客戶的 PO 號碼" />
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
          <Field label="客戶希望出貨日">
            <input type="date" value={requestedShipDate} onChange={e => setRequestedShipDate(e.target.value)} className={inp} />
          </Field>
          <Field label="付款條件">
            <input type="text" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
              className={inp} placeholder="T/T 30 days" />
          </Field>
          <div className="md:col-span-2">
            <Field label="備註">
              <textarea value={note} onChange={e => setNote(e.target.value)} className={`${inp} h-20`} />
            </Field>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-700">訂單明細</h2>
          <p className="text-xs text-gray-500 mt-0.5">可調整數量與單價。</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">商品</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-24">料號</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600 w-24">數量</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-16">單位</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600 w-28">單價 ({currencyCode})</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600 w-28">小計</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orderItems.map((item, idx) => (
              <tr key={idx}>
                <td className="px-4 py-3 font-medium text-gray-800">{item.productName}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.sku || '-'}</td>
                <td className="px-4 py-2">
                  <input type="number" min="1" value={item.qty}
                    onChange={e => setOrderItems(p => p.map((it, i) => i === idx ? { ...it, qty: e.target.value } : it))}
                    className={`${inp} text-right`} />
                </td>
                <td className="px-4 py-3 text-gray-500">{item.unit}</td>
                <td className="px-4 py-2">
                  <input type="number" step="0.0001" value={item.unitPrice}
                    onChange={e => setOrderItems(p => p.map((it, i) => i === idx ? { ...it, unitPrice: e.target.value } : it))}
                    className={`${inp} text-right`} />
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {((parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}
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
          className="bg-teal-600 text-white px-8 py-2.5 rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          {saving ? '建立中…' : '✓ 確認，建立銷售訂單'}
        </button>
        <button type="button" onClick={() => { setError(''); setMode('customer') }}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">← 修改客戶</button>
        <button type="button" onClick={() => router.push('/sales')}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">取消</button>
      </div>
    </form>
  )
}

const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'
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
