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
  cbm: number
  cbmPct: number
  isFob: boolean
  allocations: {
    costItemId: number
    costItemName: string
    allocatedTWD: number
  }[]
  totalDeductionTWD: number
}

type AllocationData = {
  suppliers: SupplierAlloc[]
  costItems: CostItem[]
  totalCostTWD: number
  totalFobCbm: number
  usedCbmFallback: boolean
}

function fmtTWD(n: number) {
  return `NT$ ${n.toLocaleString()}`
}

function fmtCbm(n: number) {
  return n === 0 ? '—' : `${n.toFixed(4)} m³`
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

  const fobSuppliers = data?.suppliers.filter(s => s.isFob) ?? []
  const forSuppliers = data?.suppliers.filter(s => !s.isFob) ?? []

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

          {/* ── 費用項目清單 ── */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                貨代費用項目（共 {data.costItems.length} 筆）
              </span>
              <span className="text-xs font-mono text-gray-700">
                合計 {fmtTWD(data.totalCostTWD)}
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
                      <span className="font-mono text-gray-600">{fmtTWD(item.amountTWD)}</span>
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

          {/* ── 供應商分攤預覽 ── */}
          {(fobSuppliers.length > 0 || forSuppliers.length > 0) && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  供應商分攤預覽
                </span>
                {data.usedCbmFallback && (
                  <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                    ⚠ 無材積資料，以金額比例分攤
                  </span>
                )}
                {!data.usedCbmFallback && data.totalFobCbm > 0 && (
                  <span className="text-xs text-gray-400">
                    FOB 總材積 {fmtCbm(data.totalFobCbm)}
                  </span>
                )}
              </div>

              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs text-gray-400 font-normal">供應商</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-400 font-normal">PO</th>
                    <th className="text-center px-3 py-2 text-xs text-gray-400 font-normal">條款</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-400 font-normal">材積</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-400 font-normal">佔比</th>
                    <th className="text-right px-4 py-2 text-xs text-gray-400 font-normal">應扣金額</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.suppliers.map(sup => (
                    <tr key={`${sup.supplierId}-${sup.poId}`}
                        className={sup.isFob ? '' : 'opacity-50'}>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{sup.supplierName}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{sup.poNo ?? '—'}</td>
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
                        {sup.isFob ? fmtCbm(sup.cbm) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-gray-600">
                        {sup.isFob ? `${sup.cbmPct.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {sup.isFob ? (
                          <span className="font-mono text-red-600 font-medium">
                            −{fmtTWD(sup.totalDeductionTWD)}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">不扣款</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 各費用明細展開（只顯示 FOB 供應商且有多筆費用時） */}
              {fobSuppliers.length > 0 && data.costItems.length > 1 && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <p className="text-xs font-semibold text-gray-400 mb-2">費用明細拆分</p>
                  {fobSuppliers.map(sup => (
                    <div key={`${sup.supplierId}-${sup.poId}-detail`} className="mb-2">
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

          {/* ── 套用按鈕 ── */}
          {fobSuppliers.length > 0 && data.costItems.length > 0 && (
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
