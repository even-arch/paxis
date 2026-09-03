'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types matching the API response ─────────────────────────────────────────

type CostItem = {
  id: number
  name: string
  amountTWD: number
}

type SupplierAlloc = {
  supplierId: number
  supplierName: string
  poId: number | null
  poNo: string | null
  tradeTerms: string | null
  amountTWD: number
  cubicFt: number
  cbmPct: number
  isFob: boolean
  allocations: {
    costItemId: number
    costItemName: string
    allocatedTWD: number
  }[]
  totalDeductionTWD: number
}

// 同一供應商多張 PO 合併後的結構
type GroupedSupplier = {
  supplierId: number
  supplierName: string
  tradeTerms: string | null
  isFob: boolean
  amountTWD: number
  cubicFt: number
  cbmPct: number
  totalDeductionTWD: number
  poNos: string[]
  allocations: { costItemId: number; costItemName: string; allocatedTWD: number }[]
}

type AllocationData = {
  suppliers: SupplierAlloc[]
  costItems: CostItem[]
  totalCostTWD: number
  totalFobCubicFt: number
  totalAllCubicFt: number
  usedCbmFallback: boolean
}

function fmtTWD(n: number) {
  return `NT$ ${n.toLocaleString()}`
}

function fmtFt(n: number) {
  return n === 0 ? '—' : `${n.toFixed(2)} ft³`
}

function groupBySupplier(suppliers: SupplierAlloc[]): GroupedSupplier[] {
  const map = new Map<number, GroupedSupplier>()
  for (const sup of suppliers) {
    const existing = map.get(sup.supplierId)
    if (existing) {
      existing.amountTWD += sup.amountTWD
      existing.cubicFt += sup.cubicFt
      existing.cbmPct += sup.cbmPct
      existing.totalDeductionTWD += sup.totalDeductionTWD
      if (sup.poNo) existing.poNos.push(sup.poNo)
      for (const alloc of sup.allocations) {
        const ex = existing.allocations.find(a => a.costItemId === alloc.costItemId)
        if (ex) ex.allocatedTWD += alloc.allocatedTWD
        else existing.allocations.push({ ...alloc })
      }
    } else {
      map.set(sup.supplierId, {
        supplierId: sup.supplierId,
        supplierName: sup.supplierName,
        tradeTerms: sup.tradeTerms,
        isFob: sup.isFob,
        amountTWD: sup.amountTWD,
        cubicFt: sup.cubicFt,
        cbmPct: sup.cbmPct,
        totalDeductionTWD: sup.totalDeductionTWD,
        poNos: sup.poNo ? [sup.poNo] : [],
        allocations: [...sup.allocations],
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => Number(b.isFob) - Number(a.isFob))
}

export default function FobAllocationPanel({ shipmentId }: { shipmentId: number }) {
  const [data, setData] = useState<AllocationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/fob-allocation`)
      if (res.ok) setData(await res.json())
      else setError('載入失敗')
    } finally {
      setLoading(false)
    }
  }, [shipmentId])

  useEffect(() => { load() }, [load])

  async function handleDeleteCostItem(itemId: number) {
    if (!confirm('確定刪除此費用項目？相關分攤記錄也會一併清除。')) return
    setDeleting(itemId)
    setError('')
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/fob-cost-items/${itemId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error ?? '刪除失敗')
      setMessage('已刪除')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗')
    } finally {
      setDeleting(null)
    }
  }

  async function handleApply() {
    if (!confirm('確認套用分攤結果？將更新各供應商的 FOB 費用扣款金額。')) return
    setApplying(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/fob-allocation`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '套用失敗')
      setMessage('✓ 分攤已套用，各供應商應付帳款已更新')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '套用失敗')
    } finally {
      setApplying(false)
    }
  }

  const grouped = data ? groupBySupplier(data.suppliers) : []
  const fobGroups = grouped.filter(g => g.isFob)

  return (
    <div className="bg-white rounded-lg shadow p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">FOB 費用分攤 &amp; 折讓單</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            依材積比例，將出口費用分攤給 FOB 供應商，並更新應付扣款金額
          </p>
        </div>
      </div>

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      {message && <p className="text-xs text-green-600 mb-2">{message}</p>}

      {loading ? (
        <p className="text-xs text-gray-400">載入中...</p>
      ) : !data ? null : (
        <div className="space-y-4">

          {/* ── 貨代費用項目（用於分攤計算的基準金額） ── */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                貨代費用項目（分攤基準）
              </span>
              <span className="text-xs font-mono text-gray-700 font-semibold">
                合計 {fmtTWD(data.totalCostTWD)}（未稅）
              </span>
            </div>
            {data.costItems.length === 0 ? (
              <p className="text-xs text-gray-400 px-4 py-3">
                尚無費用項目。請先至「報關文件」上傳貨代發票，套用費用項目後才能進行分攤。
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.costItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-gray-700">{item.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-gray-600">{fmtTWD(item.amountTWD)}（未稅）</span>
                      <button
                        onClick={() => handleDeleteCostItem(item.id)}
                        disabled={deleting === item.id}
                        className="text-gray-300 hover:text-red-500 text-lg leading-none"
                        title="刪除">
                        {deleting === item.id ? '…' : '×'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 供應商分攤預覽（按供應商合併） ── */}
          {grouped.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  供應商分攤預覽
                </span>
                <div className="flex items-center gap-2">
                  {data.usedCbmFallback ? (
                    <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                      ⚠ 無材積資料，以金額比例分攤
                    </span>
                  ) : null}
                  {data.totalAllCubicFt > 0 ? (
                    <span className="text-xs text-gray-500 font-mono">
                      出貨總材積 {fmtFt(data.totalAllCubicFt)}
                      {data.totalFobCubicFt > 0 && data.totalFobCubicFt < data.totalAllCubicFt &&
                        `（FOB ${fmtFt(data.totalFobCubicFt)}）`}
                    </span>
                  ) : data.totalFobCubicFt > 0 ? (
                    <span className="text-xs text-gray-400">
                      FOB 總材積 {fmtFt(data.totalFobCubicFt)}
                    </span>
                  ) : null}
                </div>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs text-gray-400 font-normal">供應商 / 訂單</th>
                    <th className="text-center px-3 py-2 text-xs text-gray-400 font-normal">條款</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-400 font-normal">未稅應付</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-400 font-normal">採計材積（ft³）</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-400 font-normal">佔比（全部）</th>
                    <th className="text-right px-4 py-2 text-xs text-gray-400 font-normal">應扣（未稅）</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {grouped.map(sup => (
                    <tr key={sup.supplierId}
                        className={sup.isFob ? '' : 'bg-gray-50/50'}>
                      {/* 供應商名稱 + PO 號（換行展示） */}
                      <td className="px-4 py-2.5">
                        <div className={`font-medium ${sup.isFob ? 'text-gray-800' : 'text-gray-500'}`}>{sup.supplierName}</div>
                        {sup.poNos.length > 0 && (
                          <div className="text-xs text-gray-400 font-mono mt-0.5">
                            {sup.poNos.join('、')}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                          sup.isFob
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {sup.tradeTerms ?? '未設定'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-gray-600">
                        {fmtTWD(sup.amountTWD)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-gray-600">
                        {sup.cubicFt > 0 ? fmtFt(sup.cubicFt) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs">
                        {sup.cbmPct > 0 ? (
                          <span className={sup.isFob ? 'text-gray-700 font-semibold' : 'text-gray-400'}>
                            {sup.cbmPct.toFixed(1)}%
                            {!sup.isFob && <span className="text-gray-300 ml-0.5 font-normal">*</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {sup.isFob ? (
                          <span className="font-mono text-red-600 font-medium">
                            −{fmtTWD(sup.totalDeductionTWD)}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">不分攤</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 費用明細拆分（FOB 且有多筆費用時展開） */}
              {fobGroups.length > 0 && data.costItems.length > 1 && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-400 mb-2">費用明細拆分</p>
                  {fobGroups.map(sup => (
                    <div key={`${sup.supplierId}-detail`} className="mb-2">
                      <p className="text-xs text-gray-600 font-medium mb-1">{sup.supplierName}</p>
                      <div className="pl-3 space-y-0.5">
                        {sup.allocations.map(a => (
                          <div key={a.costItemId} className="flex justify-between text-xs text-gray-500">
                            <span>{a.costItemName}</span>
                            <span className="font-mono">−{fmtTWD(a.allocatedTWD)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FOR 供應商佔比說明 */}
          {grouped.some(g => !g.isFob && g.cubicFt > 0) && (
            <p className="text-xs text-gray-400 px-1">
              * FOR 供應商佔比僅供核對參考，費用由我方承擔，不向該供應商扣款。
            </p>
          )}

          {/* ── 套用按鈕 ── */}
          {fobGroups.length > 0 && data.costItems.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={handleApply}
                disabled={applying}
                className="text-sm px-4 py-2 rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
                {applying ? '套用中...' : '確認套用分攤'}
              </button>
            </div>
          )}

          {data.suppliers.length === 0 && (
            <p className="text-xs text-gray-400">
              本次出貨尚無供應商應付帳款記錄。確認入庫後才會產生應付帳款。
            </p>
          )}
        </div>
      )}
    </div>
  )
}
