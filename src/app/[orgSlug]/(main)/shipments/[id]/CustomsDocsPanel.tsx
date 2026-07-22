'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

type DocListItem = {
  id: number
  docType: string
  fileName: string
  mimeType: string
  parsedResult: {
    summary?: string | null
    docNo?: string | null
    docDate?: string | null
    totalAmount?: number | null
    currency?: string | null
  } | null
  parseError: string | null
  uploadedAt: string
  uploader: { name: string } | null
}

type Reconciliation = {
  piTotal: { amount: number; currency: string | null } | null
  commercialInvoiceTotal: { amount: number; currency: string | null } | null
  customsDeclaredTotal: { amount: number; currency: string | null } | null
  customsDeclaredTWD: number | null
  flags: Array<{ message: string; severity: 'warn' | 'info' }>
}

type Suggestions = {
  htsBackfill: Array<{ productId: number; sku: string; productName: string; currentHtsCode: string | null; suggestedHtsCode: string }>
  freightItems: Array<{ docId: number; name: string; amountTWD: number; note?: string | null }>
  bondedWarnings: string[]
}

const DOC_TYPE_LABEL: Record<string, string> = {
  FORWARDER_INVOICE: '貨代費用發票',
  BILL_OF_LADING: '提單（B/L）',
  COMMERCIAL_INVOICE: '商業發票',
  CUSTOMS_DECLARATION: '海關出口報單',
  OTHER: '其他文件',
}
const DOC_TYPE_COLOR: Record<string, string> = {
  FORWARDER_INVOICE: 'bg-orange-50 text-orange-700',
  BILL_OF_LADING: 'bg-blue-50 text-blue-700',
  COMMERCIAL_INVOICE: 'bg-purple-50 text-purple-700',
  CUSTOMS_DECLARATION: 'bg-green-50 text-green-700',
  OTHER: 'bg-gray-100 text-gray-500',
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export default function CustomsDocsPanel({ shipmentId }: { shipmentId: number }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [docs, setDocs] = useState<DocListItem[]>([])
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [applyingKey, setApplyingKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/customs-docs`)
      if (res.ok) {
        const data = await res.json()
        setDocs(data.docs ?? [])
        setReconciliation(data.reconciliation ?? null)
        setSuggestions(data.suggestions ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [shipmentId])

  useEffect(() => { load() }, [load])

  async function handleUpload(files: FileList) {
    setUploading(true)
    setError('')
    setMessage('')
    try {
      const form = new FormData()
      Array.from(files).forEach(f => form.append('files', f))
      const res = await fetch(`/api/shipments/${shipmentId}/customs-docs`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '上傳失敗')
      const okCount = (data.results ?? []).filter((r: { ok: boolean }) => r.ok).length
      const failCount = (data.results ?? []).length - okCount
      setMessage(`已歸檔 ${okCount} 個文件${failCount > 0 ? `，${failCount} 個解析失敗（仍已歸檔，可手動查看）` : ''}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDelete(docId: number) {
    if (!confirm('確定要刪除這份歸檔文件嗎？已套用過的動作（如已建立的費用項目）不受影響。')) return
    const res = await fetch(`/api/shipments/${shipmentId}/customs-docs/${docId}`, { method: 'DELETE' })
    if (res.ok) await load()
  }

  async function applyHts(productId: number, htsCode: string, key: string) {
    setApplyingKey(key)
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/customs-docs/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hts', productId, htsCode }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? '套用失敗')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '套用失敗')
    } finally {
      setApplyingKey(null)
    }
  }

  async function applyFreightItem(name: string, amountTWD: number, note: string | null | undefined, key: string) {
    setApplyingKey(key)
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/customs-docs/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'freight_item', name, amountTWD, note }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? '套用失敗')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '套用失敗')
    } finally {
      setApplyingKey(null)
    }
  }

  const hasReconciliationData = reconciliation && (
    reconciliation.piTotal || reconciliation.commercialInvoiceTotal || reconciliation.customsDeclaredTotal
  )

  return (
    <div className="bg-white rounded-lg shadow p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">報關文件</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            上傳貨代發票、提單、商業發票、出口報單等（非必填），系統會自動歸檔並解析重點
          </p>
        </div>
        <div>
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
            className="text-xs px-3 py-1.5 rounded border border-teal-300 text-teal-700 hover:bg-teal-50 disabled:opacity-50">
            {uploading ? 'AI 解析中...' : '📎 上傳報關文件'}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      {message && <p className="text-xs text-green-600 mb-2">{message}</p>}

      {loading ? (
        <p className="text-xs text-gray-400">載入中...</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-gray-400">
          尚未上傳任何報關文件。上傳後系統會自動判斷文件種類（貨代發票/提單/商業發票/出口報單），
          解析金額與品項重點，並與系統內資料做三方勾稽。
        </p>
      ) : (
        <div className="space-y-4">
          {/* ── 三方勾稽 ── */}
          {hasReconciliationData && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">金額勾稽</h3>
              <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                <div>
                  <p className="text-xs text-gray-400">系統內 PI 總額</p>
                  <p className="font-mono">
                    {reconciliation!.piTotal ? `${reconciliation!.piTotal.currency ?? ''} ${fmt(reconciliation!.piTotal.amount)}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">商業發票金額</p>
                  <p className="font-mono">
                    {reconciliation!.commercialInvoiceTotal
                      ? `${reconciliation!.commercialInvoiceTotal.currency ?? ''} ${fmt(reconciliation!.commercialInvoiceTotal.amount)}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">出口報單金額（完稅價格 TWD {reconciliation!.customsDeclaredTWD ? fmt(reconciliation!.customsDeclaredTWD) : '—'}）</p>
                  <p className="font-mono">
                    {reconciliation!.customsDeclaredTotal
                      ? `${reconciliation!.customsDeclaredTotal.currency ?? ''} ${fmt(reconciliation!.customsDeclaredTotal.amount)}` : '—'}
                  </p>
                </div>
              </div>
              {reconciliation!.flags.length > 0 ? (
                <div className="space-y-1 mt-2">
                  {reconciliation!.flags.map((f, i) => (
                    <p key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      ⚠ {f.message}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-green-600">✓ 三方金額一致，無明顯落差</p>
              )}
            </div>
          )}

          {/* ── 保稅工廠提醒 ── */}
          {suggestions && suggestions.bondedWarnings.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">⚠ 保稅工廠合規提醒</p>
              {suggestions.bondedWarnings.map((w, i) => (
                <p key={i} className="text-xs text-red-600">{w}</p>
              ))}
            </div>
          )}

          {/* ── 建議：HTS Code 回填 ── */}
          {suggestions && suggestions.htsBackfill.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                建議：回填缺漏的 HTS Code（依出口報單稅則號別）
              </h3>
              <div className="space-y-1.5">
                {suggestions.htsBackfill.map(h => {
                  const key = `hts-${h.productId}`
                  return (
                    <div key={key} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2">
                      <span>
                        <span className="font-mono text-xs text-gray-500 mr-2">{h.sku}</span>
                        {h.productName}
                        <span className="mx-2 text-gray-300">→</span>
                        <span className="font-mono text-teal-700">{h.suggestedHtsCode}</span>
                      </span>
                      <button
                        onClick={() => applyHts(h.productId, h.suggestedHtsCode, key)}
                        disabled={applyingKey === key}
                        className="text-xs px-2.5 py-1 rounded border border-teal-300 text-teal-700 hover:bg-teal-50 disabled:opacity-50 shrink-0 ml-3">
                        {applyingKey === key ? '套用中...' : '套用'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── 建議：貨代費用項目 ── */}
          {suggestions && suggestions.freightItems.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                建議：建立費用項目（依貨代發票，供 FOB 費用平攤扣款）
              </h3>
              <div className="space-y-1.5">
                {suggestions.freightItems.map((f, i) => {
                  const key = `freight-${f.docId}-${i}`
                  return (
                    <div key={key} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2">
                      <span>{f.name}<span className="ml-2 font-mono text-gray-600">NT$ {fmt(f.amountTWD)}</span></span>
                      <button
                        onClick={() => applyFreightItem(f.name, f.amountTWD, f.note, key)}
                        disabled={applyingKey === key}
                        className="text-xs px-2.5 py-1 rounded border border-teal-300 text-teal-700 hover:bg-teal-50 disabled:opacity-50 shrink-0 ml-3">
                        {applyingKey === key ? '套用中...' : '建立費用項目'}
                      </button>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                套用後會依供應商毛重比例分攤，於「成本」頁面查看與套用扣款結果。
              </p>
            </div>
          )}

          {/* ── 已歸檔文件清單 ── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">已歸檔文件</h3>
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
              {docs.map(d => (
                <div key={d.id} className="flex items-start gap-3 px-3 py-2.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${DOC_TYPE_COLOR[d.docType] ?? DOC_TYPE_COLOR.OTHER}`}>
                    {DOC_TYPE_LABEL[d.docType] ?? d.docType}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/shipments/${shipmentId}/customs-docs/${d.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-blue-600 hover:underline truncate">
                        {d.fileName}
                      </a>
                      <span className="text-xs text-gray-300 shrink-0">
                        {new Date(d.uploadedAt).toLocaleDateString('zh-TW')} · {d.uploader?.name ?? '—'}
                      </span>
                    </div>
                    {d.parseError ? (
                      <p className="text-xs text-red-500 mt-0.5">解析失敗：{d.parseError}（檔案已歸檔，可下載查看原文件）</p>
                    ) : d.parsedResult?.summary ? (
                      <p className="text-xs text-gray-500 mt-0.5">{d.parsedResult.summary}</p>
                    ) : null}
                  </div>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="text-gray-300 hover:text-red-500 text-lg leading-none shrink-0"
                    title="刪除">×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
