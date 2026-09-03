'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// 安全解析 API 錯誤訊息：伺服器回 500 空 body 時不會再丟 JSON parse 例外
async function safeErrMsg(res: Response, fallback: string): Promise<string> {
  try { return (await res.json()).error ?? fallback } catch { return fallback }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type FobCostItem = { id: number; name: string; amountTWD: number; note: string | null }

type FreightSuggestion = { docId: number; name: string; amountTWD: number; note?: string | null }

export type SupplierPayable = {
  id: number
  supplierId: number
  supplierName: string
  supplierFullName: string
  defaultTradeTerms: string | null
  commissionPct: number
  poNo: string | null
  poId: number | null
  amountTWD: number
  fobCostDeductionTWD: number | null
  dueDate: string | null
  status: number
  tradeTerms: string | null
  voucherInfo: { id: number; voucherNo: string; status: string } | null
}

const VOUCHER_STATUS_ZH: Record<string, string> = {
  DRAFT: '草稿', SENT: '已傳送', CONFIRMED: '供應商確認', PAID: '已付款',
}

type AllocEntry = {
  supplierId: number
  isFob: boolean
  cubicFt: number
  cbmPct: number
  totalDeductionTWD: number
  allocDetails: { costItemName: string; allocatedTWD: number }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTWD(n: number) {
  return `NT$ ${Math.round(n).toLocaleString()}`
}

function isFobTerms(terms: string | null | undefined) {
  if (!terms) return false
  const t = terms.toUpperCase().trim()
  return t.startsWith('FOB') || t === 'FCA' || t === 'FAS'
}

// Group per-PO alloc entries by supplierId
function buildAllocMap(suppliers: {
  supplierId: number; isFob: boolean; cubicFt: number; cbmPct: number; totalDeductionTWD: number
  allocations: { costItemName: string; allocatedTWD: number }[]
}[]): Map<number, AllocEntry> {
  const map = new Map<number, AllocEntry>()
  for (const s of suppliers) {
    const existing = map.get(s.supplierId)
    if (existing) {
      existing.cubicFt += s.cubicFt
      existing.cbmPct += s.cbmPct
      existing.totalDeductionTWD += s.totalDeductionTWD
      for (const a of s.allocations) {
        const ex = existing.allocDetails.find(x => x.costItemName === a.costItemName)
        if (ex) ex.allocatedTWD += a.allocatedTWD
        else existing.allocDetails.push({ ...a })
      }
    } else {
      map.set(s.supplierId, {
        supplierId: s.supplierId,
        isFob: s.isFob,
        cubicFt: s.cubicFt,
        cbmPct: s.cbmPct,
        totalDeductionTWD: s.totalDeductionTWD,
        allocDetails: s.allocations.map(a => ({ ...a })),
      })
    }
  }
  return map
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  shipmentId: number
  shipmentNo: string
  actualShipDate: string | null
  customerName: string | null
  initialCostItems: FobCostItem[]
  payables: SupplierPayable[]
  onVoucherCreated: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShipmentPayablesPanel({
  shipmentId, shipmentNo, actualShipDate, customerName,
  initialCostItems, payables, onVoucherCreated,
}: Props) {
  const [costItems, setCostItems] = useState<FobCostItem[]>(initialCostItems)
  const [suggestions, setSuggestions] = useState<FreightSuggestion[]>([])
  const [allocMap, setAllocMap] = useState<Map<number, AllocEntry>>(new Map())
  const [usedCbmFallback, setUsedCbmFallback] = useState(false)
  const [totalFobCubicFt, setTotalFobCubicFt] = useState(0)
  const [totalAllCubicFt, setTotalAllCubicFt] = useState(0)
  const [totalCostTWD, setTotalCostTWD] = useState(0)

  // Form state
  const [newItemName, setNewItemName] = useState('')
  const [newItemAmount, setNewItemAmount] = useState('')

  // Loading / action state
  const [loadingAlloc, setLoadingAlloc] = useState(true)
  const [addingItem, setAddingItem] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [applyingSuggKey, setApplyingSuggKey] = useState<string | null>(null)
  const [applyingAlloc, setApplyingAlloc] = useState(false)
  const [vatMap, setVatMap] = useState<Record<number, number>>({})
  const [creatingVoucher, setCreatingVoucher] = useState<number | null>(null) // supplierId
  const [createdFor, setCreatedFor] = useState<Set<number>>(new Set())        // supplierIds done
  const [uploading, setUploading] = useState(false)

  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Load FOB allocation + customs-doc suggestions ─────────────────────────
  const loadAlloc = useCallback(async () => {
    setLoadingAlloc(true)
    try {
      const [allocRes, docsRes] = await Promise.all([
        fetch(`/api/shipments/${shipmentId}/fob-allocation`),
        fetch(`/api/shipments/${shipmentId}/customs-docs`),
      ])
      if (allocRes.ok) {
        const data = await allocRes.json()
        setAllocMap(buildAllocMap(data.suppliers ?? []))
        setUsedCbmFallback(data.usedCbmFallback ?? false)
        setTotalFobCubicFt(data.totalFobCubicFt ?? 0)
        setTotalAllCubicFt(data.totalAllCubicFt ?? 0)
        setTotalCostTWD(data.totalCostTWD ?? 0)
      }
      if (docsRes.ok) {
        const docsData = await docsRes.json()
        setSuggestions(docsData.suggestions?.freightItems ?? [])
      }
    } finally {
      setLoadingAlloc(false)
    }
  }, [shipmentId])

  useEffect(() => { loadAlloc() }, [loadAlloc])

  // ── Add cost item (manual) ────────────────────────────────────────────────
  async function addCostItem() {
    if (!newItemName.trim() || !newItemAmount) return
    setAddingItem(true); setError('')
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/customs-docs/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'freight_item', name: newItemName.trim(), amountTWD: Number(newItemAmount), note: null }),
      })
      if (!res.ok) throw new Error(await safeErrMsg(res, '新增失敗'))
      const data = await res.json()
      setCostItems(prev => [...prev, { id: data.itemId, name: newItemName.trim(), amountTWD: Number(newItemAmount), note: null }])
      setNewItemName(''); setNewItemAmount('')
      await loadAlloc()
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增失敗')
    } finally {
      setAddingItem(false)
    }
  }

  // ── Delete cost item ──────────────────────────────────────────────────────
  async function deleteCostItem(id: number) {
    if (!confirm('確定刪除此費用項目？相關分攤記錄也會一併清除。')) return
    setDeletingId(id); setError('')
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/fob-cost-items/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await safeErrMsg(res, '刪除失敗'))
      setCostItems(prev => prev.filter(i => i.id !== id))
      await loadAlloc()
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗')
    } finally {
      setDeletingId(null)
    }
  }

  // ── Apply suggestion from customs docs ────────────────────────────────────
  async function applySuggestion(s: FreightSuggestion, key: string) {
    setApplyingSuggKey(key); setError('')
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/customs-docs/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'freight_item', name: s.name, amountTWD: s.amountTWD, note: s.note }),
      })
      if (!res.ok) throw new Error(await safeErrMsg(res, '套用失敗'))
      const data = await res.json()
      setCostItems(prev => [...prev, { id: data.itemId, name: s.name, amountTWD: s.amountTWD, note: s.note ?? null }])
      setSuggestions(prev => prev.filter(x => !(x.name === s.name && x.amountTWD === s.amountTWD && x.docId === s.docId)))
      await loadAlloc()
    } catch (err) {
      setError(err instanceof Error ? err.message : '套用失敗')
    } finally {
      setApplyingSuggKey(null)
    }
  }

  // ── Upload forwarder invoice → AI parse → suggestions ────────────────────
  async function handleUpload(files: FileList) {
    setUploading(true); setError('')
    try {
      const form = new FormData()
      Array.from(files).forEach(f => form.append('files', f))
      const res = await fetch(`/api/shipments/${shipmentId}/customs-docs`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '上傳失敗')
      const okCount = (data.results ?? []).filter((r: { ok: boolean }) => r.ok).length
      const failCount = (data.results ?? []).length - okCount
      setMsg(`已解析 ${okCount} 個文件${failCount > 0 ? `，${failCount} 個解析失敗` : ''}，建議已更新`)
      await loadAlloc()
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ── Apply FOB allocation to DB ────────────────────────────────────────────
  async function applyAllocation() {
    if (!confirm('確認套用 FOB 分攤？將更新各供應商的應付扣款金額。')) return
    setApplyingAlloc(true); setError('')
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/fob-allocation`, { method: 'POST' })
      if (!res.ok) throw new Error(await safeErrMsg(res, '套用失敗'))
      setMsg('✓ FOB 分攤已套用')
      await loadAlloc()
    } catch (err) {
      setError(err instanceof Error ? err.message : '套用失敗')
    } finally {
      setApplyingAlloc(false)
    }
  }

  // ── Create payment voucher for a supplier (只針對尚未建單的 payable) ─────────
  async function createVoucher(supplierId: number) {
    const supplierPayables = payables.filter(p => p.supplierId === supplierId && !p.voucherInfo)
    if (supplierPayables.length === 0) return

    const alloc = allocMap.get(supplierId)
    const isFob = alloc?.isFob ?? false
    const deductionTWD = isFob ? (alloc?.totalDeductionTWD ?? 0) : 0
    const vatPct = vatMap[supplierId] ?? 5

    const adjustments = deductionTWD > 0 ? [{
      name: `FOB 費用分攤（${shipmentNo}）`,
      amountTWD: -deductionTWD,
      category: 'LOGISTICS',
      note: (alloc?.allocDetails ?? []).map(a => `${a.costItemName}: -NT$${a.allocatedTWD.toLocaleString()}`).join('; '),
    }] : []

    setCreatingVoucher(supplierId); setError('')
    try {
      const res = await fetch('/api/finance/payment-vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          payableIds: supplierPayables.map(p => p.id),
          adjustments,
          vatPct,
          note: null,
        }),
      })
      if (!res.ok) throw new Error(await safeErrMsg(res, '建立失敗'))
      const sup = supplierPayables[0]
      setMsg(`✓ 已建立 ${sup.supplierName} 的付款通知單`)
      setCreatedFor(prev => new Set(Array.from(prev).concat(supplierId)))
      onVoucherCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立失敗')
    } finally {
      setCreatingVoucher(null)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  // Group payables by supplierId (a supplier may have multiple POs in this shipment)
  const supplierGroups = Array.from(
    payables.reduce((map, p) => {
      const existing = map.get(p.supplierId)
      if (existing) {
        existing.payables.push(p)
        existing.totalAmountTWD += p.amountTWD
      } else {
        map.set(p.supplierId, {
          supplierId: p.supplierId,
          supplierName: p.supplierName,
          tradeTerms: p.tradeTerms,
          payables: [p],
          totalAmountTWD: p.amountTWD,
        })
      }
      return map
    }, new Map<number, { supplierId: number; supplierName: string; tradeTerms: string | null; payables: SupplierPayable[]; totalAmountTWD: number }>()).values()
  )

  const fobGroupCount = supplierGroups.filter(g => isFobTerms(g.tradeTerms)).length

  return (
    <div className="divide-y divide-gray-100">

      {error && <p className="text-xs text-red-500 px-4 pt-3">{error}</p>}
      {msg && <p className="text-xs text-green-600 px-4 pt-3">{msg}</p>}

      {/* ── FOB 費用項目管理 ────────────────────────────────────────────── */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              FOB 費用項目（分攤基準）
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              貨代發票的費用，依材積比例分攤給 FOB 供應商
            </p>
          </div>
          <div className="flex items-center gap-3">
            {totalCostTWD > 0 && (
              <span className="text-sm font-mono text-gray-700 font-semibold">
                合計 {fmtTWD(totalCostTWD)}
              </span>
            )}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={e => { if (e.target.files?.length) handleUpload(e.target.files) }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-xs px-3 py-1.5 rounded border border-teal-300 text-teal-700 hover:bg-teal-50 disabled:opacity-50 whitespace-nowrap">
              {uploading ? 'AI 解析中...' : '📎 上傳貨代發票'}
            </button>
          </div>
        </div>

        {/* 現有費用項目 */}
        {costItems.length > 0 ? (
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 mb-3">
            {costItems.map(item => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-gray-700">{item.name}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-gray-600">{fmtTWD(item.amountTWD)}</span>
                  <button
                    onClick={() => deleteCostItem(item.id)}
                    disabled={deletingId === item.id}
                    className="text-gray-300 hover:text-red-500 text-lg leading-none"
                    title="刪除">
                    {deletingId === item.id ? '…' : '×'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : !loadingAlloc ? (
          <p className="text-xs text-gray-400 mb-3">
            尚無費用項目。請上傳貨代發票讓 AI 解析，或直接手動輸入金額。
          </p>
        ) : null}

        {/* 從報關文件解析的建議 */}
        {suggestions.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
            <p className="text-xs font-semibold text-amber-700 mb-2">
              📄 報關文件解析建議（{suggestions.length} 筆可匯入）
            </p>
            <div className="space-y-1.5">
              {suggestions.map((s, i) => {
                const key = `${s.docId}-${i}`
                return (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span>
                      <span className="text-gray-700">{s.name}</span>
                      <span className="ml-2 font-mono text-gray-500">{fmtTWD(s.amountTWD)}</span>
                    </span>
                    <button
                      onClick={() => applySuggestion(s, key)}
                      disabled={applyingSuggKey === key}
                      className="text-xs px-2.5 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-100 disabled:opacity-50 shrink-0 ml-3">
                      {applyingSuggKey === key ? '加入中...' : '加入'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 手動新增費用項目 */}
        <div className="flex gap-2">
          <input
            placeholder="費用名稱（如：海運費、拖車費）"
            value={newItemName}
            onChange={e => setNewItemName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addCostItem() }}
            className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <input
            type="number"
            placeholder="NT$ 金額"
            value={newItemAmount}
            onChange={e => setNewItemAmount(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addCostItem() }}
            className="w-36 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            onClick={addCostItem}
            disabled={addingItem || !newItemName.trim() || !newItemAmount}
            className="px-4 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {addingItem ? '...' : '+ 新增'}
          </button>
        </div>

        {/* CBM fallback 提醒 */}
        {usedCbmFallback && costItems.length > 0 && (
          <p className="text-xs text-amber-600 mt-2">⚠ 無材積（CBM）資料，改以應付金額比例分攤（分母為全部供應商）</p>
        )}
        {!usedCbmFallback && totalAllCubicFt > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            出貨總材積 {totalAllCubicFt.toFixed(2)} ft³（分母）；其中 FOB {totalFobCubicFt.toFixed(2)} ft³（{((totalFobCubicFt / totalAllCubicFt) * 100).toFixed(1)}%）、FOR {(totalAllCubicFt - totalFobCubicFt).toFixed(2)} ft³（{(((totalAllCubicFt - totalFobCubicFt) / totalAllCubicFt) * 100).toFixed(1)}%*）。
            * FOR 供應商佔比僅供核對，費用由我方承擔，不扣款。
          </p>
        )}
      </div>

      {/* ── 供應商付款明細 ──────────────────────────────────────────────── */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            供應商付款
          </h3>
          {costItems.length > 0 && fobGroupCount > 0 && (
            <button
              onClick={applyAllocation}
              disabled={applyingAlloc}
              className="text-xs px-3 py-1.5 rounded border border-teal-300 text-teal-700 hover:bg-teal-50 disabled:opacity-50">
              {applyingAlloc ? '套用中...' : '確認套用 FOB 分攤'}
            </button>
          )}
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2 text-xs text-gray-400 font-normal">供應商 / 採購單</th>
                <th className="text-center px-3 py-2 text-xs text-gray-400 font-normal">條款</th>
                <th className="text-right px-3 py-2 text-xs text-gray-400 font-normal">應付金額</th>
                <th className="text-right px-3 py-2 text-xs text-gray-400 font-normal">FOB 扣款</th>
                <th className="text-right px-3 py-2 text-xs text-gray-400 font-normal">淨付款</th>
                <th className="px-4 py-2 text-xs text-gray-400 font-normal text-right">稅率 / 開單</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {supplierGroups.map(group => {
                const alloc = allocMap.get(group.supplierId)
                const isFob = isFobTerms(group.tradeTerms)
                const deduction = isFob && alloc ? alloc.totalDeductionTWD : 0
                const commissionPct = group.payables[0]?.commissionPct ?? 0
                const commission = commissionPct > 0 ? Math.round(group.totalAmountTWD * commissionPct / 100) : 0
                const netAmount = group.totalAmountTWD - deduction - commission
                const vat = vatMap[group.supplierId] ?? 5
                const vatAmount = Math.round(netAmount * vat / 100)
                // 全部 payable 都已有通知單 = 已完成；或本次剛建立
                const allVouchered = group.payables.every(p => p.voucherInfo != null)
                const done = allVouchered || createdFor.has(group.supplierId)
                // 找已建單的資訊（若有多張取第一張）
                const groupVoucherInfo = group.payables.find(p => p.voucherInfo)?.voucherInfo ?? null

                return (
                  <tr key={group.supplierId} className={!isFob ? 'opacity-70' : ''}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{group.supplierName}</div>
                      {group.payables.map(p => p.poNo).filter(Boolean).length > 0 && (
                        <div className="text-xs text-gray-400 font-mono mt-0.5">
                          {group.payables.map(p => p.poNo).filter(Boolean).join('、')}
                        </div>
                      )}
                      {/* 材積 / 採計佔比（全部供應商都顯示） */}
                      {alloc && (alloc.cubicFt > 0 || alloc.cbmPct > 0) && (
                        <div className="text-xs mt-0.5">
                          {alloc.cubicFt > 0 && (
                            <span className="text-gray-400 font-mono">
                              採計 {alloc.cubicFt.toFixed(2)} ft³
                            </span>
                          )}
                          {alloc.cbmPct > 0 && (
                            <span className={`ml-1 font-mono ${isFob ? 'text-blue-500 font-semibold' : 'text-gray-400'}`}>
                              ({alloc.cbmPct.toFixed(1)}%{!isFob ? ' *' : ''})
                            </span>
                          )}
                        </div>
                      )}
                      {/* FOB 費用拆分明細 */}
                      {isFob && alloc && alloc.allocDetails.length > 0 && deduction > 0 && (
                        <div className="mt-1 pl-1 space-y-0.5">
                          {alloc.allocDetails.map(d => (
                            <div key={d.costItemName} className="text-xs text-gray-400">
                              {d.costItemName}：−NT$ {d.allocatedTWD.toLocaleString()}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* 佣金 / Rebate */}
                      {commissionPct > 0 && (
                        <div className="text-xs text-purple-500 mt-0.5">
                          佣金 {commissionPct}%：−NT$ {commission.toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                        isFob ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {group.tradeTerms ?? '未設定'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-gray-600">
                      {fmtTWD(group.totalAmountTWD)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs">
                      {isFob && deduction > 0 ? (
                        <span className="text-red-600">−{fmtTWD(deduction)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="font-mono text-xs font-semibold text-gray-800">{fmtTWD(netAmount)}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        含稅 {fmtTWD(netAmount + vatAmount)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {done ? (
                        <div className="space-y-1 text-right">
                          <div className="text-xs text-green-600 font-medium">✓ 已開通知單</div>
                          {groupVoucherInfo && (
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                groupVoucherInfo.status === 'PAID' ? 'bg-green-100 text-green-700' :
                                groupVoucherInfo.status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                                groupVoucherInfo.status === 'CONFIRMED' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {VOUCHER_STATUS_ZH[groupVoucherInfo.status] ?? groupVoucherInfo.status}
                              </span>
                              <a
                                href={`/print/pv/${groupVoucherInfo.id}`}
                                target="_blank"
                                className="text-xs font-mono text-blue-500 hover:underline">
                                {groupVoucherInfo.voucherNo}
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={vat}
                            onChange={e => setVatMap(prev => ({ ...prev, [group.supplierId]: Number(e.target.value) }))}
                            className="border border-gray-200 rounded text-xs px-1.5 py-1 text-gray-600 focus:outline-none">
                            <option value={5}>含稅 5%</option>
                            <option value={0}>免稅</option>
                          </select>
                          <button
                            onClick={() => createVoucher(group.supplierId)}
                            disabled={creatingVoucher === group.supplierId}
                            className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
                            {creatingVoucher === group.supplierId ? '建立中...' : '建立付款通知單'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
