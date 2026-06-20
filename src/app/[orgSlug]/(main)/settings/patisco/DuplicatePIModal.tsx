'use client'

import { useState } from 'react'
import type { PIConflict } from '@/api/patisco/sync'

type Props = {
  conflicts: PIConflict[]
  onResolved: (piNo: string) => void
  onClose: () => void
}

function formatDate(raw: string | null): string {
  if (!raw || raw.length < 8) return '-'
  // 格式：20260613064441
  const y = raw.slice(0, 4), m = raw.slice(4, 6), d = raw.slice(6, 8)
  const hh = raw.slice(8, 10), mm = raw.slice(10, 12)
  return `${y}-${m}-${d} ${hh}:${mm}`
}

export default function DuplicatePIModal({ conflicts, onResolved, onClose }: Props) {
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (conflicts.length === 0) return null

  const safeIdx = Math.min(current, conflicts.length - 1)
  const conflict = conflicts[safeIdx]
  const isLast = safeIdx === conflicts.length - 1

  async function handleChoose(docId: string) {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/patisco/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ piNo: conflict.piNo, chosenDocId: docId }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? '解決失敗')
      onResolved(conflict.piNo)
      // 不手動 setCurrent：onResolved 從 parent 移除這筆後，
      // 下一筆自然滑到 conflicts[safeIdx] 位置，
      // 若全部解決則 conflicts.length === 0，modal 自動關閉。
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知錯誤')
    } finally {
      setLoading(false)
    }
  }

  function handleSkip() {
    if (isLast) onClose()
    else setCurrent(c => c + 1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">發現重複的 PI 單號</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              以下 PI 在 Patisco 有多筆記錄，請選擇要保留哪一筆。
              （{current + 1} / {conflicts.length}）
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* PI 號碼 */}
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-100">
          <span className="text-sm text-amber-700 font-medium">PI 號碼：</span>
          <span className="font-mono font-bold text-amber-900 ml-1">{conflict.piNo}</span>
        </div>

        {/* 兩筆記錄並排 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            {conflict.records.map((rec, idx) => (
              <div key={rec.docId} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* 版本標題 */}
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">版本 {idx + 1}</span>
                  <span className="font-mono text-xs text-gray-400">{rec.docId}</span>
                </div>

                {/* 基本資訊 */}
                <div className="px-4 py-3 space-y-2 border-b border-gray-100">
                  <Row label="買方" value={rec.buyerName ?? '-'} />
                  <Row label="建立日期" value={formatDate(rec.date)} />
                  <Row label="總金額" value={rec.amount ? `$ ${rec.amount}` : '-'} />
                </div>

                {/* 品項列表 */}
                <div className="px-4 py-3">
                  <p className="text-xs font-medium text-gray-500 mb-2">品項（{rec.products.length} 筆）</p>
                  {rec.products.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">無品項資料</p>
                  ) : (
                    <div className="space-y-2">
                      {rec.products.map((p, pi) => (
                        <div key={pi} className="bg-gray-50 rounded px-3 py-2 text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-semibold text-gray-700">{p.sku || '-'}</span>
                            {p.modelNo && <span className="text-gray-400">{p.modelNo}</span>}
                          </div>
                          {p.specification && (
                            <p className="text-gray-500 whitespace-pre-wrap leading-relaxed">{p.specification}</p>
                          )}
                          <div className="flex gap-3 mt-1.5 text-gray-600">
                            <span>數量：{p.quantity ?? '-'} {p.unit ?? ''}</span>
                            <span>單價：{p.price ?? '-'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 選擇按鈕 */}
                <div className="px-4 py-3 border-t border-gray-100">
                  <button
                    onClick={() => handleChoose(rec.docId)}
                    disabled={loading}
                    className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? '處理中...' : '✓ 保留這筆'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4 px-4 py-2 bg-red-50 text-red-600 text-sm rounded">✗ {error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex justify-between items-center">
          <p className="text-xs text-gray-400">選擇後系統會依照你選的版本建立 SLS_PI 記錄</p>
          <button onClick={handleSkip} disabled={loading} className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50">
            {isLast ? '關閉' : '略過，看下一筆 →'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex text-sm">
      <span className="w-20 text-gray-400 shrink-0">{label}</span>
      <span className="text-gray-800 font-medium">{value}</span>
    </div>
  )
}
