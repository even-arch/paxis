'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useOrgPath } from '@/lib/use-org-path'
import { SHIP_VIA, CURRENCIES } from '@/modules/purchase/poUtils'
import type { ParsedInvoice } from '@/app/api/ai/parse-invoice/route'
import type { AppliedProduct } from '@/app/api/ai/apply-products/route'

// ─── 資料庫現有資料型別（由 page.tsx SSR 傳入）────────────────────────────────
type DbSupplier = {
  id: number; name: string; shortName: string | null; currencyCode: string | null
  email: string | null; phoneNo: string | null; address: string | null
  city: string | null; countryCode: string | null; paymentTerms: string | null
}
type DbProduct = { id: number; name: string; sku: string | null; unit: string | null; specification: string | null }

// ─── 精靈內部 state 型別 ──────────────────────────────────────────────────────
type ProductDraft = {
  name: string; specification: string; sku: string
  qty: string; unitPrice: string; unit: string
  htsCode: string
  conflictId: number | null; conflictName: string; conflictSpec: string; conflictSku: string
  hasDiff: boolean; action: 'create' | 'use-existing'
  /** 如果 parsedSku 是用「前綴比對」到 DB 的，這裡存原始解析到的 sku */
  parsedSkuRaw: string
  isPartialSkuMatch: boolean
}
type SupplierDraft = {
  name: string; shortName: string; email: string; phone: string
  address: string; city: string; country: string; postalCode: string; taxId: string
  contactPerson: string; paymentTerms: string; currencyCode: string
  matchedId: number | null; matchedSupplier: DbSupplier | null
}

// 步驟 1 完成後儲存的結果（已寫入 DB）
type SavedProduct = { productId: number; productName: string; sku: string | null; qty: number; unitPrice: number; unit: string; isNew: boolean; originalName: string }
// 步驟 2 完成後儲存的結果（已寫入 DB）
type SavedSupplier = { supplierId: number; supplierName: string; isNew: boolean }

type Mode = 'upload' | 'products' | 'supplier' | 'po'

export default function ImportWizard({
  suppliers: initSuppliers,
  products:  initProducts,
}: {
  suppliers: DbSupplier[]
  products:  DbProduct[]
}) {
  const router = useRouter()
  const toOrgPath = useOrgPath()
  const [mode, setMode] = useState<Mode>('upload')

  // 解析結果（供 UI 用）
  const [productDrafts,  setProductDrafts]  = useState<ProductDraft[]>([])
  const [supplierDraft,  setSupplierDraft]  = useState<SupplierDraft>({
    name: '', shortName: '', email: '', phone: '', address: '', city: '', country: '',
    postalCode: '', taxId: '',
    contactPerson: '', paymentTerms: '', currencyCode: 'USD',
    matchedId: null, matchedSupplier: null,
  })

  // ★ 步驟 1 成功寫入 DB 後的結果
  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([])
  // ★ 步驟 2 成功寫入 DB 後的結果
  const [savedSupplier, setSavedSupplier] = useState<SavedSupplier | null>(null)

  // 供應商訂單欄位
  const [sourceType,   setSourceType]   = useState('0')
  const [docRefNo,     setDocRefNo]     = useState('')
  const [currencyCode, setCurrencyCode] = useState('USD')
  const [exchangeRate, setExchangeRate] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [port,         setPort]         = useState('')
  const [shipVia,      setShipVia]      = useState('')
  const [note,         setNote]         = useState('')
  // 文件日期（從 AI 解析的 invoiceDate 預填）
  const [docDate, setDocDate] = useState('')
  // 可讓使用者在 PO 表單調整數量與單價
  const [poItems, setPoItems] = useState<{ productId: number; productName: string; sku: string | null; qty: string; unitPrice: string; unit: string; productNameSnapshot: string | null }[]>([])
  // 供應商候選清單（API 回傳 needConfirm=true 時使用）
  const [supplierCandidates, setSupplierCandidates] = useState<{ id: number; name: string; shortName: string | null; city: string | null; countryCode: string | null }[]>([])
  const [showCandidatePicker, setShowCandidatePicker] = useState(false)

  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // ─── 多檔案佇列 ──────────────────────────────────────────────────────────────
  const [fileQueue,   setFileQueue]   = useState<File[]>([])
  const [queueIndex,  setQueueIndex]  = useState(0)
  // 已成功處理的單號列表（用於最終摘要）
  const [doneList,    setDoneList]    = useState<{ poNo: string; id: number }[]>([])

  const stepLabels = ['上傳單據', '存入產品', '存入供應商', '建立供應商訂單']
  const stepIdx = { upload: 0, products: 1, supplier: 2, po: 3 }[mode]

  // 重置精靈內部狀態（準備處理下一個檔案）
  function resetWizardState() {
    setMode('upload')
    setProductDrafts([])
    setSupplierDraft({ name: '', shortName: '', email: '', phone: '', address: '', city: '', country: '', postalCode: '', taxId: '', contactPerson: '', paymentTerms: '', currencyCode: 'USD', matchedId: null, matchedSupplier: null })
    setSavedProducts([])
    setSavedSupplier(null)
    setSourceType('0'); setDocRefNo(''); setCurrencyCode('USD'); setExchangeRate('')
    setExpectedDate(''); setPort(''); setShipVia(''); setNote(''); setDocDate('')
    setPoItems([])
    setSupplierCandidates([]); setShowCandidatePicker(false)
    setError('')
  }

  // 直接以 File 物件啟動 AI 解析
  async function processFile(file: File) {
    setLoading(true); setError('')
    try {
      const fd = new FormData(); fd.append('file', file)
      const res  = await fetch('/api/ai/parse-invoice', { method: 'POST', body: fd })
      const json = await res.json() as { data?: ParsedInvoice; error?: string }
      if (!res.ok) throw new Error(json.error ?? `解析失敗 (HTTP ${res.status})`)
      const inv = json.data!

      // 本地 SKU 衝突偵測（含前綴比對：PDF 有時把備注塞在 SKU 欄）
      const drafts: ProductDraft[] = (inv.items ?? []).map(it => {
        const parsedSkuRaw = it.sku?.trim() ?? ''
        const skuLower = parsedSkuRaw.toLowerCase()

        // 1. 完全相符
        let ex = parsedSkuRaw ? initProducts.find(p => p.sku && p.sku.toLowerCase() === skuLower) : undefined
        let isPartialSkuMatch = false

        // 2. 前綴相符（PDF SKU 欄帶了額外後綴，例如「12345 EXTRA INFO」→ DB 裡只有「12345」）
        if (!ex && parsedSkuRaw) {
          ex = initProducts.find(p =>
            p.sku && skuLower.startsWith(p.sku.toLowerCase() + ' ')
          )
          if (ex) isPartialSkuMatch = true
        }

        const sku = isPartialSkuMatch && ex ? ex.sku! : parsedSkuRaw
        const hasDiff = ex
          ? isPartialSkuMatch ||
            ex.name.toLowerCase() !== (it.name?.trim().toLowerCase() ?? '') ||
            (ex.specification ?? '') !== (it.specification?.trim() ?? '')
          : false
        return {
          name: it.name?.trim() ?? '', specification: it.specification?.trim() ?? '', sku,
          qty: String(it.qty ?? 1), unitPrice: String(it.unitPrice ?? 0), unit: it.unit?.trim() ?? 'PCS',
          htsCode: it.htsCode?.trim() ?? '',
          conflictId: ex?.id ?? null, conflictName: ex?.name ?? '',
          conflictSpec: ex?.specification ?? '', conflictSku: ex?.sku ?? '',
          hasDiff, action: ex ? 'use-existing' : 'create',
          parsedSkuRaw, isPartialSkuMatch,
        }
      })
      setProductDrafts(drafts)

      // 本地供應商比對
      const supName = inv.supplierName?.trim() ?? ''
      const matched = supName
        ? initSuppliers.find(s =>
            s.name.toLowerCase() === supName.toLowerCase() ||
            (s.shortName && s.shortName.toLowerCase() === supName.toLowerCase()))
        : undefined

      setSupplierDraft({
        name: supName, shortName: '', email: inv.supplierEmail?.trim() ?? '',
        phone: inv.supplierPhone?.trim() ?? '',
        address: inv.supplierAddress?.trim() ?? '',
        city: inv.supplierCity?.trim() ?? '',
        country: inv.supplierCountry?.trim() ?? '',
        postalCode: '', taxId: '',
        contactPerson: '', paymentTerms: '', currencyCode: inv.currency ?? 'USD',
        matchedId: matched?.id ?? null, matchedSupplier: matched ?? null,
      })

      if (inv.invoiceNo)   setDocRefNo(inv.invoiceNo)
      if (inv.currency)    setCurrencyCode(inv.currency)
      if (inv.invoiceDate) setDocDate(inv.invoiceDate)

      setMode('products')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  // ─── 多檔案入口：收集所有選取的檔案，啟動第一個 ────────────────────────────
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    e.target.value = ''
    setFileQueue(files)
    setQueueIndex(0)
    setDoneList([])
    processFile(files[0])
  }

  // 跳過目前這個檔案，處理下一個
  function skipCurrent() {
    const nextIdx = queueIndex + 1
    if (nextIdx < fileQueue.length) {
      resetWizardState()
      setQueueIndex(nextIdx)
      processFile(fileQueue[nextIdx])
    } else {
      // 沒有下一個，回到上傳畫面
      setFileQueue([]); setQueueIndex(0); setDoneList([])
      resetWizardState()
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
            name:          d.name,
            specification: d.specification || null,
            sku:           d.sku || null,
            qty:           Number(d.qty),
            unitPrice:     Number(d.unitPrice),
            unit:          d.unit,
            htsCode:       d.htsCode || null,
            action:        d.action,
            conflictId:    d.conflictId,
          })),
        }),
      })
      const json = await res.json() as { data?: AppliedProduct[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? `寫入失敗 (HTTP ${res.status})`)

      const applied = json.data!
      // ★ 儲存寫入結果（含 DB productId）
      const saved: SavedProduct[] = applied.map((ap, idx) => ({
        productId:    ap.productId,
        productName:  ap.productName,
        sku:          ap.sku,
        qty:          ap.qty,
        unitPrice:    ap.unitPrice,
        unit:         ap.unit,
        isNew:        ap.productCreated,
        originalName: productDrafts[idx]?.name.trim() || ap.productName,
      }))
      setSavedProducts(saved)

      // 初始化 PO 品項（使用已解析的 productId，名稱優先用使用者在步驟 1 手動調整的版本）
      setPoItems(saved.map((s, idx) => ({
        productId:           s.productId,
        productName:         productDrafts[idx]?.name.trim() || s.productName,
        sku:                 s.sku,
        qty:                 String(s.qty),
        unitPrice:           String(s.unitPrice),
        unit:                s.unit,
        productNameSnapshot: productDrafts[idx]?.name.trim() || s.productName || null,
      })))

      setMode('supplier')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  // ─── 步驟 2：確認供應商 → 立即寫入 DB ──────────────────────────────────────
  async function saveSupplier(opts?: { forceCreate?: boolean; useExistingId?: number }) {
    if (!supplierDraft.name.trim()) { setError('請填入供應商名稱'); return }
    setLoading(true); setError('')
    try {
      // 永遠呼叫 API，由 API 決定是沿用現有還是新建（避免本地快取的 id 過期）
      const res = await fetch('/api/ai/apply-supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName:      supplierDraft.name,
          supplierShortName: supplierDraft.shortName || null,
          supplierEmail:     supplierDraft.email || null,
          phone:             supplierDraft.phone || null,
          address:           supplierDraft.address || null,
          city:              supplierDraft.city || null,
          country:           supplierDraft.country || null,
          postalCode:        supplierDraft.postalCode || null,
          taxId:             supplierDraft.taxId || null,
          contactPerson:     supplierDraft.contactPerson || null,
          paymentTerms:      supplierDraft.paymentTerms || null,
          currencyCode:      supplierDraft.currencyCode || null,
          forceCreate:       opts?.forceCreate ?? false,
          useExistingId:     opts?.useExistingId ?? null,
        }),
      })
      const json = await res.json() as {
        ok: boolean
        needConfirm?: boolean
        candidates?: { id: number; name: string; shortName: string | null; city: string | null; countryCode: string | null }[]
        data?: { supplierId: number; supplierName: string; supplierCreated: boolean }
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? `寫入失敗 (HTTP ${res.status})`)

      // API 回傳「需要使用者確認」→ 顯示候選清單
      if (json.needConfirm && json.candidates) {
        setSupplierCandidates(json.candidates)
        setShowCandidatePicker(true)
        return
      }

      // ★ 儲存供應商結果（含 DB supplierId）
      setSavedSupplier({
        supplierId:   json.data!.supplierId,
        supplierName: json.data!.supplierName,
        isNew:        json.data!.supplierCreated,
      })
      setShowCandidatePicker(false)
      setMode('po')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  // ─── 步驟 3：建立供應商訂單（供應商 & 產品均已在 DB）──────────────────────────
  async function submitPO(e: React.FormEvent) {
    e.preventDefault()
    if (!savedSupplier) { setError('供應商尚未確認'); return }
    if (!poItems.length) { setError('至少需要一項產品'); return }

    setSaving(true); setError('')
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId:   savedSupplier.supplierId,
          poNo:         docRefNo || undefined,
          orderDate:    docDate || null,
          sourceType:   Number(sourceType),
          currencyCode,
          exchangeRate: exchangeRate || '1',
          expectedDate,
          port,
          shipVia,
          note: note || null,
          items: poItems.map(i => ({
            productId:           i.productId,
            quantity:            Number(i.qty),
            unitPrice:           i.unitPrice,
            unit:                i.unit,
            note:                '',
            productNameSnapshot: i.productNameSnapshot || null,
          })),
        }),
      })
      const json = await res.json() as { id?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? `建立失敗 (HTTP ${res.status})`)
      // 多檔佇列：如果還有下一個檔案，繼續處理；否則跳轉到詳情頁
      const nextIdx = queueIndex + 1
      setDoneList(prev => [...prev, { poNo: docRefNo || `#${json.id}`, id: json.id! }])
      if (nextIdx < fileQueue.length) {
        setQueueIndex(nextIdx)
        resetWizardState()
        processFile(fileQueue[nextIdx])
      } else {
        router.push(toOrgPath(`/purchases/${json.id}`))
        router.refresh()
      }
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

  // 多檔佇列進度列（只在批次模式顯示）
  const QueueBar = () => {
    if (fileQueue.length <= 1) return null
    const total = fileQueue.length
    const current = queueIndex + 1
    const pct = Math.round(((current - 1) / total) * 100)
    return (
      <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-blue-800">
            正在處理第 {current} / {total} 個檔案
            {fileQueue[queueIndex] && (
              <span className="ml-2 text-blue-500 font-normal text-xs">
                {fileQueue[queueIndex].name}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={skipCurrent}
            className="text-xs text-blue-500 hover:text-blue-700 underline">
            跳過此檔案
          </button>
        </div>
        <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        {doneList.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {doneList.map((d, i) => (
              <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                ✓ {d.poNo}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 步驟 0：上傳
  // ══════════════════════════════════════════════════════════════════════════════
  if (mode === 'upload') {
    return (
      <div className="max-w-2xl">
        <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.txt" className="hidden" onChange={handleFile} />
        <QueueBar />
        <ErrBar />
        {loading ? (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">⏳</div>
            <p className="text-purple-700 font-medium">AI 解析中，請稍候…</p>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-full flex flex-col items-center gap-4 bg-white border-2 border-dashed border-purple-300 rounded-xl p-12 hover:border-purple-500 hover:bg-purple-50 transition-all text-center">
            <span className="text-5xl">📄</span>
            <div>
              <p className="font-semibold text-gray-800 text-lg">點擊上傳供應商訂單或形式發票（PI）</p>
              <p className="text-sm text-gray-500 mt-1">支援 PDF、Excel、圖片（JPG / PNG）</p>
              <p className="text-xs text-purple-600 mt-3">AI 自動識別產品與供應商資料，逐步確認後建立供應商訂單</p>
            </div>
          </button>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 步驟 1：確認產品，確認後立即寫入 DB
  // ══════════════════════════════════════════════════════════════════════════════
  if (mode === 'products') {
    return (
      <div className="max-w-5xl space-y-4">
        <QueueBar />
        <StepBar />
        <ErrBar />
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">步驟 1：確認產品資料</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              確認後按「存入產品資料庫」，系統立即寫入。<span className="text-amber-600">⚠ 黃底 = 料號已存在但資料有差異，請選擇要使用現有還是建新的。</span>
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
                        <p className="font-medium text-amber-700 mb-2">
                          ⚠ 找到相似的既有產品（料號：{item.conflictSku || item.sku}），請確認是否為同一個商品
                        </p>
                        {/* 差異點列表 */}
                        <ul className="mb-2 space-y-1 text-amber-800">
                          {item.isPartialSkuMatch && (
                            <li>• 文件 SKU 欄位帶有額外後綴：「{item.parsedSkuRaw}」→ 系統判斷前綴「{item.conflictSku}」符合</li>
                          )}
                          {item.conflictName.toLowerCase() !== item.name.toLowerCase() && (
                            <li>• 名稱不同：現有「{item.conflictName}」／文件「{item.name}」</li>
                          )}
                          {(item.conflictSpec || '') !== (item.specification || '') && (
                            <li>• 規格不同：現有「{item.conflictSpec || '（空）'}」／文件「{item.specification || '（空）'}」</li>
                          )}
                        </ul>
                        <div className="grid grid-cols-2 gap-3 text-gray-600 border-t border-amber-100 pt-2">
                          <div><p className="text-gray-400 mb-0.5">現有產品</p>
                            <p className="font-medium">{item.conflictName}</p>
                            <p className="text-gray-400 mt-0.5">{item.conflictSpec || '-'}</p>
                          </div>
                          <div><p className="text-gray-400 mb-0.5">文件內容</p>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-gray-400 mt-0.5">{item.specification || '-'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0 pt-1">
                        <button type="button"
                          onClick={() => setProductDrafts(p => p.map((d, i) => i === idx ? { ...d, action: 'use-existing', sku: d.conflictSku || d.sku } : d))}
                          className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap ${item.action === 'use-existing' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>
                          ✓ 是同一個，沿用現有
                        </button>
                        <button type="button"
                          onClick={() => setProductDrafts(p => p.map((d, i) => i === idx ? { ...d, action: 'create', sku: d.parsedSkuRaw, conflictId: null } : d))}
                          className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap ${item.action === 'create' ? 'bg-orange-500 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>
                          ✕ 不同，另建新產品
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

  // ══════════════════════════════════════════════════════════════════════════════
  // 步驟 2：確認供應商，確認後立即寫入 DB
  // ══════════════════════════════════════════════════════════════════════════════
  if (mode === 'supplier') {
    const ms = supplierDraft.matchedSupplier
    return (
      <div className="max-w-2xl space-y-4">
        <QueueBar />
        <StepBar />

        {/* 步驟 1 已完成的摘要 */}
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          ✓ 已寫入 {savedProducts.filter(s => s.isNew).length} 筆新產品，{savedProducts.filter(s => !s.isNew).length} 筆沿用現有。
        </div>

        <ErrBar />
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">步驟 2：確認供應商</h2>
          <p className="text-xs text-gray-500 mb-3">確認後按「存入供應商資料庫」，系統立即寫入。</p>
          {!supplierDraft.name.trim() && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
              ⚠ AI 無法從文件中識別供應商名稱，請手動填入。
            </div>
          )}

          {ms && (
            <div className="mb-5 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-700 mb-2">系統找到現有供應商「{ms.name}」，請確認是否為同一家：</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                {ms.shortName    && <div><span className="text-gray-400">簡稱：</span>{ms.shortName}</div>}
                {ms.email        && <div><span className="text-gray-400">Email：</span>{ms.email}</div>}
                {ms.phoneNo      && <div><span className="text-gray-400">電話：</span>{ms.phoneNo}</div>}
                {ms.paymentTerms && <div><span className="text-gray-400">付款：</span>{ms.paymentTerms}</div>}
                {ms.currencyCode && <div><span className="text-gray-400">幣別：</span>{ms.currencyCode}</div>}
                {(ms.city || ms.countryCode) && (
                  <div className="col-span-2"><span className="text-gray-400">地址：</span>{[ms.address, ms.city, ms.countryCode].filter(Boolean).join(', ')}</div>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => setSupplierDraft(d => ({ ...d, matchedId: ms.id, matchedSupplier: ms }))}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${supplierDraft.matchedId === ms.id ? 'bg-blue-600 text-white' : 'bg-white border border-blue-300 text-blue-700'}`}>
                  ✓ 是，使用此供應商
                </button>
                <button type="button"
                  onClick={() => setSupplierDraft(d => ({ ...d, matchedId: null, matchedSupplier: null }))}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${!supplierDraft.matchedId ? 'bg-orange-500 text-white' : 'bg-white border border-gray-300 text-gray-600'}`}>
                  不是，建立新供應商
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="供應商全名" required>
              <input type="text" value={supplierDraft.name}
                onChange={e => setSupplierDraft(d => ({ ...d, name: e.target.value }))} className={inp} />
            </Field>
            <Field label="簡稱">
              <input type="text" value={supplierDraft.shortName}
                onChange={e => setSupplierDraft(d => ({ ...d, shortName: e.target.value }))} className={inp} placeholder="例：EXCEL" />
            </Field>
            <Field label="Email">
              <input type="email" value={supplierDraft.email}
                onChange={e => setSupplierDraft(d => ({ ...d, email: e.target.value }))} className={inp} />
            </Field>
            <Field label="電話">
              <input type="text" value={supplierDraft.phone}
                onChange={e => setSupplierDraft(d => ({ ...d, phone: e.target.value }))} className={inp} />
            </Field>
            <Field label="城市">
              <input type="text" value={supplierDraft.city}
                onChange={e => setSupplierDraft(d => ({ ...d, city: e.target.value }))} className={inp} />
            </Field>
            <Field label="郵遞區號">
              <input type="text" value={supplierDraft.postalCode}
                onChange={e => setSupplierDraft(d => ({ ...d, postalCode: e.target.value }))} className={inp} placeholder="例：700" />
            </Field>
            <Field label="國家">
              <input type="text" value={supplierDraft.country}
                onChange={e => setSupplierDraft(d => ({ ...d, country: e.target.value }))} className={inp} placeholder="TAIWAN" />
            </Field>
            <Field label="統編 / Tax ID">
              <input type="text" value={supplierDraft.taxId}
                onChange={e => setSupplierDraft(d => ({ ...d, taxId: e.target.value }))} className={inp} placeholder="例：12345678" />
            </Field>
            <div className="col-span-2">
              <Field label="地址">
                <input type="text" value={supplierDraft.address}
                  onChange={e => setSupplierDraft(d => ({ ...d, address: e.target.value }))} className={inp} />
              </Field>
            </div>
            <Field label="慣用幣別">
              <select value={supplierDraft.currencyCode}
                onChange={e => { setSupplierDraft(d => ({ ...d, currencyCode: e.target.value })); setCurrencyCode(e.target.value) }}
                className={inp}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="付款條件">
              <input type="text" value={supplierDraft.paymentTerms}
                onChange={e => setSupplierDraft(d => ({ ...d, paymentTerms: e.target.value }))} className={inp} placeholder="T/T 30 days" />
            </Field>
          </div>

          {/* 候選供應商選擇面板（API 回傳 needConfirm 時顯示）*/}
          {showCandidatePicker && (
            <div className="mt-4 bg-amber-50 border border-amber-300 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-800 mb-3">
                ⚠ 找到名稱相似的現有供應商，請確認是否為同一家？
              </p>
              <div className="space-y-2 mb-4">
                {supplierCandidates.map(c => (
                  <button key={c.id} type="button"
                    onClick={() => saveSupplier({ useExistingId: c.id })}
                    disabled={loading}
                    className="w-full text-left px-4 py-3 rounded-md border border-amber-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-sm transition-colors">
                    <span className="font-medium text-gray-800">{c.name}</span>
                    {c.shortName && <span className="ml-2 text-gray-500 text-xs">({c.shortName})</span>}
                    {(c.city || c.countryCode) && (
                      <span className="ml-2 text-gray-400 text-xs">{[c.city, c.countryCode].filter(Boolean).join(', ')}</span>
                    )}
                  </button>
                ))}
              </div>
              <button type="button"
                onClick={() => saveSupplier({ forceCreate: true })}
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-orange-50 hover:border-orange-300 transition-colors">
                ✕ 以上都不是，建立全新供應商「{supplierDraft.name}」
              </button>
              <button type="button" onClick={() => setShowCandidatePicker(false)}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline w-full text-center">
                取消，重新修改供應商資料
              </button>
            </div>
          )}

          <div className="flex justify-between mt-6">
            <button type="button" onClick={() => { setError(''); setMode('products') }}
              className="text-sm text-gray-400 hover:text-gray-600">← 上一步</button>
            {!showCandidatePicker && (
              <button type="button" onClick={() => saveSupplier()} disabled={loading}
                className="bg-green-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {loading ? '寫入中…' : supplierDraft.matchedId ? '✓ 確認，使用現有供應商' : '✓ 確認，新增至供應商資料庫'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 步驟 3：建立供應商訂單（產品與供應商均已在 DB）
  // ══════════════════════════════════════════════════════════════════════════════
  const subtotal = poItems.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.unitPrice) || 0), 0)

  return (
    <form onSubmit={submitPO} className="space-y-6 max-w-4xl">
      <QueueBar />
      <StepBar />

      {/* 已完成摘要 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          ✓ 產品已存入資料庫：{savedProducts.length} 項（{savedProducts.filter(s => s.isNew).length} 筆新建）
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          ✓ 供應商已確認：{savedSupplier?.supplierName}{savedSupplier?.isNew ? '（新建）' : '（現有）'}
        </div>
      </div>

      <ErrBar />

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">供應商訂單資料</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="採購觸發來源" required>
            <select value={sourceType} onChange={e => setSourceType(e.target.value)} className={inp}>
              <option value="0">主動補貨（預測/季節/促銷）</option>
              <option value="1">接單後採購（Made to Order）</option>
              <option value="2">安全庫存觸發（低於警戒線）</option>
            </select>
          </Field>
          <Field label="供應商訂單號">
            <input type="text" value={docRefNo} onChange={e => setDocRefNo(e.target.value)} className={inp} placeholder="沿用原始文件號，空白則自動產生" />
          </Field>
          <Field label="文件日期（採購訂單日期）">
            <input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} className={inp} />
          </Field>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">供應商</label>
            <div className={`${inp} bg-gray-50 text-gray-700`}>{savedSupplier?.supplierName}</div>
          </div>
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

      {/* 採購明細（可調整數量和單價）*/}
      <section className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-700">採購明細</h2>
          <p className="text-xs text-gray-500 mt-0.5">產品已確認，可調整數量與單價。</p>
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
            {poItems.map((item, idx) => (
              <tr key={idx}>
                <td className="px-4 py-3 font-medium text-gray-800">{item.productName}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.sku || '-'}</td>
                <td className="px-4 py-2">
                  <input type="number" min="1" value={item.qty}
                    onChange={e => setPoItems(p => p.map((it, i) => i === idx ? { ...it, qty: e.target.value } : it))}
                    className={`${inp} text-right`} />
                </td>
                <td className="px-4 py-3 text-gray-500">{item.unit}</td>
                <td className="px-4 py-2">
                  <input type="number" step="0.0001" value={item.unitPrice}
                    onChange={e => setPoItems(p => p.map((it, i) => i === idx ? { ...it, unitPrice: e.target.value } : it))}
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
          className="bg-blue-600 text-white px-8 py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? '建立中…' : '✓ 確認，建立供應商訂單'}
        </button>
        <button type="button" onClick={() => { setError(''); setMode('supplier') }}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">← 修改供應商</button>
        <button type="button" onClick={() => router.push('/dashboard')}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">取消</button>
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
