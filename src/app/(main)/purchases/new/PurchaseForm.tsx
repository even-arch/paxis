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

// 步驟 1 的可編輯草稿（含本地 SKU 衝突偵測結果）
type ReviewProduct = {
  name: string
  specification: string
  sku: string
  qty: string
  unitPrice: string
  unit: string
  // 衝突偵測（本地比對）
  conflictId: number | null    // 現有產品 ID（SKU 匹配）
  conflictName: string
  conflictSpec: string
  hasDiff: boolean             // import 與現有資料有差異
  action: 'create' | 'use-existing'  // 使用者決定
}

// 步驟 2 的供應商草稿（含本地名稱匹配結果）
type SupplierDraft = {
  name: string
  shortName: string
  email: string
  contactPerson: string
  paymentTerms: string
  currencyCode: string
  matchedId: number | null     // 現有供應商 ID（名稱匹配）
  matchedName: string | null
  matchedEmail: string | null
  matchedShortName: string | null
}

type Mode = 'choose' | 'review-products' | 'review-supplier' | 'form'

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
  const [mode, setMode] = useState<Mode>('choose')

  // ── 精靈暫存 ─────────────────────────────────────────────────────────────────
  const [reviewItems,  setReviewItems]  = useState<ReviewProduct[]>([])
  const [supplierDraft, setSupplierDraft] = useState<SupplierDraft>({
    name: '', shortName: '', email: '', contactPerson: '', paymentTerms: '', currencyCode: 'USD',
    matchedId: null, matchedName: null, matchedEmail: null, matchedShortName: null,
  })

  // ── PO 表單欄位 ───────────────────────────────────────────────────────────────
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

  const [error,   setError]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  // ─────────────────────────────────────────────────────────────────────────────
  // 步驟 0：上傳 & AI 解析（本地衝突偵測）
  // ─────────────────────────────────────────────────────────────────────────────
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
      if (inv.invoiceNo) setDocRefNo(inv.invoiceNo)
      if (inv.currency)  setCurrencyCode(inv.currency)

      // ── 本地 SKU 衝突偵測 ──────────────────────────────────────────────────
      const reviewed: ReviewProduct[] = (inv.items ?? []).map(it => {
        const sku = it.sku?.trim() ?? ''
        const existing = sku
          ? products.find(p => p.sku && p.sku.toLowerCase() === sku.toLowerCase())
          : undefined
        const hasDiff = existing ? (
          existing.name.toLowerCase() !== (it.name?.trim() ?? '').toLowerCase() ||
          (existing.specification ?? '') !== (it.specification?.trim() ?? '')
        ) : false

        return {
          name:          it.name?.trim() ?? '',
          specification: it.specification?.trim() ?? '',
          sku,
          qty:       String(it.qty ?? 1),
          unitPrice: String(it.unitPrice ?? 0),
          unit:      it.unit?.trim() ?? 'PCS',
          conflictId:   existing?.id ?? null,
          conflictName: existing?.name ?? '',
          conflictSpec: existing?.specification ?? '',
          hasDiff,
          action: existing ? 'use-existing' : 'create',
        }
      })
      setReviewItems(reviewed)

      // ── 本地供應商名稱比對 ──────────────────────────────────────────────────
      const supName = inv.supplierName?.trim() ?? ''
      const matched = supName
        ? suppliers.find(s =>
            s.name.toLowerCase().includes(supName.toLowerCase()) ||
            supName.toLowerCase().includes(s.name.toLowerCase()) ||
            (s.shortName && s.shortName.toLowerCase().includes(supName.toLowerCase()))
          )
        : undefined

      setSupplierDraft({
        name:          supName,
        shortName:     '',
        email:         inv.supplierEmail?.trim() ?? '',
        contactPerson: '',
        paymentTerms:  '',
        currencyCode:  inv.currency ?? 'USD',
        matchedId:     matched?.id ?? null,
        matchedName:   matched?.name ?? null,
        matchedEmail:  matched ? null : null,
        matchedShortName: matched?.shortName ?? null,
      })

      setMsg({ type: 'ok', text: `解析完成，共 ${reviewed.length} 項。請依序確認下列資料再建立採購單。` })
      setMode('review-products')
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 步驟 1：確認產品 → 寫入 DB
  // ─────────────────────────────────────────────────────────────────────────────
  async function confirmProducts() {
    setLoading(true)
    setMsg({ type: 'info', text: '正在寫入產品資料…' })
    try {
      // 不論 action，全部送給 apply-products；後端用 SKU 比對，action='use-existing' 的會自動 match
      const res = await fetch('/api/ai/apply-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: reviewItems.map(d => ({
            name:          d.action === 'use-existing' ? d.conflictName || d.name : d.name,
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
      // refresh 產品清單
      const r = await fetch('/api/products?limit=2000')
      const freshProducts = r.ok ? ((await r.json()) as { products?: Product[] }).products ?? [] : products
      setProducts(freshProducts)
      setItems(applied.map(ap => ({
        productId: String(ap.productId),
        quantity:  String(ap.qty),
        unitPrice: String(ap.unitPrice),
        unit:      ap.unit,
        note:      '',
      })))

      const newCount = applied.filter(a => a.productCreated).length
      setMsg({ type: 'ok', text: `產品確認完成${newCount ? `（新建 ${newCount} 筆）` : '（全部比對現有）'}，請繼續確認供應商。` })
      setMode('review-supplier')
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 步驟 2：確認供應商 → 寫入 DB
  // ─────────────────────────────────────────────────────────────────────────────
  async function confirmSupplier() {
    if (!supplierDraft.name.trim()) { setError('請填入供應商名稱'); return }
    setLoading(true)
    setMsg({ type: 'info', text: '正在寫入供應商資料…' })
    setError('')
    try {
      let resolvedId: number

      if (supplierDraft.matchedId) {
        // 已有供應商，直接使用
        resolvedId = supplierDraft.matchedId
      } else {
        // 新建供應商
        const res = await fetch('/api/ai/apply-supplier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierName:      supplierDraft.name,
            supplierEmail:     supplierDraft.email || null,
            supplierShortName: supplierDraft.shortName || null,
            contactPerson:     supplierDraft.contactPerson || null,
            paymentTerms:      supplierDraft.paymentTerms || null,
            currencyCode:      supplierDraft.currencyCode || null,
          }),
        })
        const data = await res.json() as { data?: AppliedSupplier; error?: string }
        if (!res.ok) throw new Error(data.error ?? '供應商寫入失敗')
        resolvedId = data.data!.supplierId
      }

      // 同時 refresh 供應商 + 產品清單（確保進入 form 時兩者都是最新的）
      const [suppRes, prodRes] = await Promise.all([
        fetch('/api/suppliers?limit=500'),
        fetch('/api/products?limit=2000'),
      ])
      const freshSuppliers = suppRes.ok ? ((await suppRes.json()) as { suppliers?: Supplier[] }).suppliers ?? [] : suppliers
      const freshProducts  = prodRes.ok ? ((await prodRes.json()) as { products?: Product[] }).products ?? [] : products

      // 批次更新所有 state，確保 form render 時資料齊全
      setSuppliers(freshSuppliers)
      setProducts(freshProducts)
      setSupplierId(String(resolvedId))
      if (supplierDraft.currencyCode) setCurrencyCode(supplierDraft.currencyCode)

      setMsg({ type: 'ok', text: `供應商確認完成（${supplierDraft.name}），請檢查採購單資料後儲存。` })
      setMode('form')
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 步驟 3：提交採購單
  // ─────────────────────────────────────────────────────────────────────────────
  function getProductSpec(id: string) { return products.find(p => String(p.id) === id)?.specification ?? '' }
  function getProductSku(id: string)  { return products.find(p => String(p.id) === id)?.sku ?? '' }
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

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId) { setError('請選擇供應商'); return }
    const validItems = items.filter(i => i.productId && i.quantity && i.unitPrice)
    if (!validItems.length) { setError('請至少輸入一項採購明細'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId, sourceType: Number(sourceType),
        currencyCode, exchangeRate: exchangeRate || '1',
        expectedDate, port, shipVia,
        note: [docRefNo ? `單據號：${docRefNo}` : '', note].filter(Boolean).join('\n'),
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
    const d = await res.json()
    router.push(`/purchases/${d.id}`)
    router.refresh()
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 進度條
  // ─────────────────────────────────────────────────────────────────────────────
  const stepLabels = ['上傳單據', '確認產品', '確認供應商', '填寫採購單']
  const stepIndex  = { choose: 0, 'review-products': 1, 'review-supplier': 2, form: 3 }[mode]

  const StepBar = () => (
    <div className="flex items-center gap-0 mb-6">
      {stepLabels.map((s, i) => (
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
          {i < stepLabels.length - 1 && (
            <div className={`mx-2 h-px w-8 ${i < stepIndex ? 'bg-green-300' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )

  const MsgBar = () => !msg ? null : (
    <div className={`rounded-lg px-4 py-3 text-sm mb-4 ${
      msg.type === 'ok'  ? 'bg-green-50 border border-green-200 text-green-700' :
      msg.type === 'err' ? 'bg-red-50 border border-red-200 text-red-700' :
                           'bg-blue-50 border border-blue-200 text-blue-700'
    }`}>{msg.text}</div>
  )

  // ══════════════════════════════════════════════════════════════════════════════
  // 選擇畫面
  // ══════════════════════════════════════════════════════════════════════════════
  if (mode === 'choose') {
    return (
      <div className="max-w-2xl">
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.txt"
          className="hidden" onChange={handleAiParse} />
        {loading ? (
          <div className="mb-6 bg-purple-50 border border-purple-200 rounded-xl p-6 text-center">
            <p className="text-2xl mb-2">⏳</p>
            <p className="text-purple-700 font-medium">{msg?.text}</p>
          </div>
        ) : msg?.type === 'err' ? (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {msg.text}
            <button onClick={() => setMsg(null)} className="ml-2 underline text-xs">關閉</button>
          </div>
        ) : (
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
  // 步驟 1：確認產品（含 SKU 衝突比對）
  // ══════════════════════════════════════════════════════════════════════════════
  if (mode === 'review-products') {
    return (
      <div className="max-w-5xl space-y-4">
        <StepBar />
        <MsgBar />

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">步驟 1：確認產品資料</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              確認後正式寫入產品資料庫。可在此編輯名稱、料號、規格。
              <span className="ml-2 text-amber-600">⚠ 黃色底色 = 料號已存在但資料有差異，請確認要使用哪一筆。</span>
            </p>
          </div>

          <div className="divide-y divide-gray-50">
            {reviewItems.map((item, idx) => {
              const isConflict = item.conflictId !== null && item.hasDiff
              const isMatched  = item.conflictId !== null && !item.hasDiff

              return (
                <div key={idx} className={`px-6 py-4 ${isConflict ? 'bg-amber-50' : ''}`}>
                  {/* 衝突警告列 */}
                  {isConflict && (
                    <div className="mb-3 flex items-start gap-3">
                      <div className="flex-1 bg-white border border-amber-200 rounded p-3 text-xs">
                        <p className="font-medium text-amber-700 mb-1">⚠ 料號「{item.sku}」已存在</p>
                        <div className="grid grid-cols-2 gap-2 text-gray-600">
                          <div>
                            <p className="text-gray-400 mb-0.5">現有名稱</p>
                            <p>{item.conflictName || '-'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 mb-0.5">匯入名稱</p>
                            <p>{item.name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 mb-0.5">現有規格</p>
                            <p className="line-clamp-2">{item.conflictSpec || '-'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 mb-0.5">匯入規格</p>
                            <p className="line-clamp-2">{item.specification || '-'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <button type="button"
                          onClick={() => setReviewItems(prev => prev.map((d, i) => i === idx ? { ...d, action: 'use-existing' } : d))}
                          className={`px-3 py-1.5 rounded text-xs font-medium ${item.action === 'use-existing' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>
                          使用現有
                        </button>
                        <button type="button"
                          onClick={() => setReviewItems(prev => prev.map((d, i) => i === idx ? { ...d, action: 'create', sku: '' } : d))}
                          className={`px-3 py-1.5 rounded text-xs font-medium ${item.action === 'create' ? 'bg-orange-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>
                          建新產品
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 已自動比對的提示 */}
                  {isMatched && (
                    <p className="text-xs text-green-600 mb-2">✓ 料號「{item.sku}」已存在且資料一致，將自動比對現有產品。</p>
                  )}

                  {/* 可編輯欄位 */}
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-3">
                      <label className="text-xs text-gray-500 mb-0.5 block">商品名稱</label>
                      <input type="text" value={item.name}
                        onChange={e => setReviewItems(prev => prev.map((d, i) => i === idx ? { ...d, name: e.target.value } : d))}
                        className={inp} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 mb-0.5 block">料號 (SKU)</label>
                      <input type="text" value={item.sku}
                        onChange={e => setReviewItems(prev => prev.map((d, i) => i === idx ? { ...d, sku: e.target.value } : d))}
                        className={`${inp} font-mono text-xs`} />
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs text-gray-500 mb-0.5 block">規格說明</label>
                      <input type="text" value={item.specification}
                        onChange={e => setReviewItems(prev => prev.map((d, i) => i === idx ? { ...d, specification: e.target.value } : d))}
                        className={inp} />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-500 mb-0.5 block">數量</label>
                      <input type="number" value={item.qty}
                        onChange={e => setReviewItems(prev => prev.map((d, i) => i === idx ? { ...d, qty: e.target.value } : d))}
                        className={`${inp} text-right`} />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-500 mb-0.5 block">單位</label>
                      <input type="text" value={item.unit}
                        onChange={e => setReviewItems(prev => prev.map((d, i) => i === idx ? { ...d, unit: e.target.value } : d))}
                        className={inp} />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-500 mb-0.5 block">單價</label>
                      <input type="number" step="0.0001" value={item.unitPrice}
                        onChange={e => setReviewItems(prev => prev.map((d, i) => i === idx ? { ...d, unitPrice: e.target.value } : d))}
                        className={`${inp} text-right`} />
                    </div>
                  </div>
                </div>
              )
            })}
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
    const isNew = supplierDraft.matchedId === null

    return (
      <div className="max-w-2xl space-y-4">
        <StepBar />
        <MsgBar />

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">步驟 2：確認供應商</h2>
          <p className="text-xs text-gray-500 mb-5">
            {isNew ? '系統中未找到相符的供應商，填寫資料後將建立新供應商。'
                   : `找到現有供應商「${supplierDraft.matchedName}」，請確認是否為同一家。`}
          </p>

          {/* 已有供應商：顯示現有資料供比對 */}
          {!isNew && (
            <div className="mb-5 bg-green-50 border border-green-200 rounded p-4 text-sm">
              <p className="font-medium text-green-700 mb-2">✓ 系統中已有此供應商</p>
              <div className="grid grid-cols-2 gap-2 text-gray-700 text-xs">
                <div><span className="text-gray-400">名稱：</span>{supplierDraft.matchedName}</div>
                {supplierDraft.matchedShortName && <div><span className="text-gray-400">簡稱：</span>{supplierDraft.matchedShortName}</div>}
                {supplierDraft.matchedEmail && <div><span className="text-gray-400">Email：</span>{supplierDraft.matchedEmail}</div>}
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button"
                  onClick={() => setSupplierDraft(d => ({ ...d, matchedId: d.matchedId }))}
                  className="px-3 py-1.5 bg-green-600 text-white text-xs rounded font-medium">
                  ✓ 是，使用此供應商
                </button>
                <button type="button"
                  onClick={() => setSupplierDraft(d => ({ ...d, matchedId: null }))}
                  className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs rounded">
                  不是，建立新供應商
                </button>
              </div>
            </div>
          )}

          {/* 供應商詳細資料（新建時顯示，或已有但確認不是同一家時也顯示） */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="供應商全名" required>
                <input type="text" value={supplierDraft.name}
                  onChange={e => setSupplierDraft(d => ({ ...d, name: e.target.value }))}
                  className={inp} placeholder="例：EXCEL SPORTS INC." />
              </Field>
              <Field label="簡稱">
                <input type="text" value={supplierDraft.shortName}
                  onChange={e => setSupplierDraft(d => ({ ...d, shortName: e.target.value }))}
                  className={inp} placeholder="例：EXCEL" />
              </Field>
              <Field label="聯絡人">
                <input type="text" value={supplierDraft.contactPerson}
                  onChange={e => setSupplierDraft(d => ({ ...d, contactPerson: e.target.value }))}
                  className={inp} placeholder="例：John Smith" />
              </Field>
              <Field label="Email">
                <input type="email" value={supplierDraft.email}
                  onChange={e => setSupplierDraft(d => ({ ...d, email: e.target.value }))}
                  className={inp} />
              </Field>
              <Field label="慣用幣別">
                <select value={supplierDraft.currencyCode}
                  onChange={e => setSupplierDraft(d => ({ ...d, currencyCode: e.target.value }))}
                  className={inp}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="付款條件">
                <input type="text" value={supplierDraft.paymentTerms}
                  onChange={e => setSupplierDraft(d => ({ ...d, paymentTerms: e.target.value }))}
                  className={inp} placeholder="例：T/T 30 days, L/C at sight" />
              </Field>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

          <div className="flex items-center justify-between mt-6">
            <button type="button" onClick={() => { setMode('review-products'); setMsg(null); setError('') }}
              className="text-sm text-gray-400 hover:text-gray-600">← 上一步</button>
            <button type="button" onClick={confirmSupplier} disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? '寫入中…' : `${supplierDraft.matchedId ? '使用現有供應商' : '建立供應商'}，繼續 →`}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 步驟 3：填寫採購單
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <StepBar />
      {msg?.type === 'ok' && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          {msg.text}
        </div>
      )}

      <section className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-700">採購資訊</h2>
          <button type="button" onClick={() => { setMode('choose'); setMsg(null) }}
            className="text-xs text-gray-400 hover:text-purple-600">✨ 重新上傳單據</button>
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
            const spec = getProductSpec(item.productId)
            const sku  = getProductSku(item.productId)
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
          <span className="text-lg font-semibold text-gray-800 ml-2">
            {currencyCode} {subtotal.toFixed(2)}
          </span>
        </div>
      </section>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? '儲存中...' : '儲存草稿'}
        </button>
        <button type="button" onClick={() => setMode('review-supplier')}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
          ← 修改供應商
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
