'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ALERTS_CHANGED_EVENT } from '@/components/AlertsNavBadge'

interface DataAlert {
  id: number
  type: string
  refType: string
  refId: number | null
  refNo: string | null
  message: string
  detail: Record<string, unknown> | null
  syncJobId: number | null
  createdAt: string
}

interface FinanceAlert {
  shipmentId: number
  shipmentNo: string
  level: 'warn' | 'error'
  issues: string[]
  grossPct: number | null
}

const TYPE_META: Record<string, { label: string; cls: string }> = {
  PI_CONFLICT:   { label: 'PI 衝突',      cls: 'bg-red-100 text-red-700' },
  MISSING_PI:    { label: 'PI 缺漏',      cls: 'bg-orange-100 text-orange-700' },
  UNLINKED_ITEM: { label: '未連結品項',   cls: 'bg-yellow-100 text-yellow-700' },
  WORKFLOW_GAP:  { label: '流程缺口',     cls: 'bg-blue-100 text-blue-700' },
}

function refLink(orgSlug: string, refType: string, refId: number | null, refNo: string | null) {
  if (!refId) return null
  const label = refNo || `#${refId}`
  if (refType === 'SLS')              return { href: `/${orgSlug}/shipments/${refId}`,  label }
  if (refType === 'PI')               return { href: `/${orgSlug}/sales/pi/${refId}`,   label }
  if (refType === 'PO_CustomerCopy')  return { href: `/${orgSlug}/sales/${refId}`,      label }
  if (refType === 'PO')               return { href: `/${orgSlug}/purchases/${refId}`,  label }
  return null
}

const FIN_DISMISSED_KEY = 'paxis:dismissed-alerts'
function loadFinDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(FIN_DISMISSED_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}
function saveFinDismissed(ids: Set<string>) {
  localStorage.setItem(FIN_DISMISSED_KEY, JSON.stringify(Array.from(ids)))
}

export default function AlertsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()

  // ── 資料品質告警 ──────────────────────────────────────────────────
  const [alerts, setAlerts] = useState<DataAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [rescanLoading, setRescanLoading] = useState(false)
  const [rescanResult, setRescanResult] = useState<string | null>(null)
  const [resolvingId, setResolvingId] = useState<number | null>(null)

  // ── 財務異常 ──────────────────────────────────────────────────────
  const [financeAlerts, setFinanceAlerts] = useState<FinanceAlert[]>([])
  const [finDismissed, setFinDismissed] = useState<Set<string>>(new Set())
  const [analyzing, setAnalyzing] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [dataRes, finRes] = await Promise.all([
        fetch('/api/data-alerts'),
        fetch('/api/finance/alerts'),
      ])
      const data = await dataRes.json()
      setAlerts(data.alerts ?? [])
      const fin = await finRes.json()
      setFinanceAlerts(fin.alerts ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setFinDismissed(loadFinDismissed())
    load()
  }, [])

  async function resolve(id: number) {
    setResolvingId(id)
    try {
      const res = await fetch(`/api/data-alerts/${id}`, { method: 'PATCH' })
      if (res.ok) {
        setAlerts(prev => prev.filter(a => a.id !== id))
        window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT))
      }
    } finally {
      setResolvingId(null)
    }
  }

  async function rescan() {
    setRescanLoading(true)
    setRescanResult(null)
    try {
      const res = await fetch('/api/data-alerts/rescan', { method: 'POST' })
      const data = await res.json()
      const parts = [`清除了 ${data.cleaned ?? 0} 筆過期警示（共掃描 ${data.total ?? 0} 筆）`]
      if (data.created > 0) parts.push(`新發現 ${data.created} 筆流程缺口`)
      setRescanResult(parts.join('，'))
      await load()
      window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT))
    } finally {
      setRescanLoading(false)
    }
  }

  function dismissFinance(shipmentId: number) {
    const next = new Set(finDismissed)
    next.add(String(shipmentId))
    setFinDismissed(next)
    saveFinDismissed(next)
    setSummary(null)
    window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT))
  }

  function dismissAllFinance() {
    const next = new Set(finDismissed)
    visibleFinance.forEach(a => next.add(String(a.shipmentId)))
    setFinDismissed(next)
    saveFinDismissed(next)
    window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT))
    setSummary(null)
  }

  async function analyze() {
    setAnalyzing(true); setSummary(null); setAnalyzeError(null)
    try {
      const res = await fetch('/api/finance/alerts/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alerts: visibleFinance }),
      })
      const d = await res.json() as { summary?: string; error?: string }
      if (d.error) setAnalyzeError(d.error)
      else setSummary(d.summary ?? '')
    } catch { setAnalyzeError('分析請求失敗') }
    finally { setAnalyzing(false) }
  }

  // Group data alerts by type
  const grouped = alerts.reduce<Record<string, DataAlert[]>>((acc, a) => {
    ;(acc[a.type] ??= []).push(a)
    return acc
  }, {})
  const typeOrder = ['PI_CONFLICT', 'MISSING_PI', 'WORKFLOW_GAP', 'UNLINKED_ITEM']
  const sortedTypes = [
    ...typeOrder.filter(t => grouped[t]),
    ...Object.keys(grouped).filter(t => !typeOrder.includes(t)),
  ]

  const visibleFinance = financeAlerts.filter(a => !finDismissed.has(String(a.shipmentId)))
  const financeErrorCount = visibleFinance.filter(a => a.level === 'error').length

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-2">
      {/* ══ 資料品質告警 ══ */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">資料警示</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {loading ? '載入中…' : alerts.length === 0 ? '目前無未處理警示' : `${alerts.length} 筆待處理`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={rescan} disabled={rescanLoading || loading}
              className="text-xs text-gray-500 border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40">
              {rescanLoading ? '掃描中…' : '重新偵測'}
            </button>
            <button onClick={load} disabled={loading}
              className="text-xs text-blue-600 border border-blue-200 rounded px-3 py-1.5 hover:bg-blue-50 disabled:opacity-40">
              重新整理
            </button>
          </div>
        </div>

        {rescanResult && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
            ✅ {rescanResult}
          </div>
        )}

        {!loading && alerts.length === 0 && (
          <div className="bg-white border rounded-lg p-8 text-center text-gray-400 text-sm">
            目前沒有未處理的資料警示 ✓
          </div>
        )}

        {sortedTypes.map(type => {
          const meta = TYPE_META[type] ?? { label: type, cls: 'bg-gray-100 text-gray-600' }
          const items = grouped[type]
          return (
            <div key={type} className="bg-white border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.cls}`}>
                  {meta.label}
                </span>
                <span className="text-xs text-gray-400">{items.length} 筆</span>
              </div>
              <div className="divide-y">
                {items.map(alert => {
                  const link = refLink(orgSlug, alert.refType, alert.refId, alert.refNo)
                  const hint = (alert.detail as { hint?: string } | null)?.hint
                  return (
                    <div key={alert.id} className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-gray-50">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {link ? (
                            <Link href={link.href}
                              className="text-xs font-mono font-medium text-blue-600 hover:underline">
                              {link.label}
                            </Link>
                          ) : (
                            <span className="text-xs text-gray-400 font-mono">—</span>
                          )}
                          <span className="text-xs text-gray-400">{alert.refType}</span>
                        </div>
                        <p className="text-sm text-gray-700">{alert.message}</p>
                        {hint && <p className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">{hint}</p>}
                        <p className="text-xs text-gray-300">
                          {new Date(alert.createdAt).toLocaleDateString('zh-TW', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <button
                        onClick={() => resolve(alert.id)}
                        disabled={resolvingId === alert.id}
                        className="shrink-0 text-xs text-gray-400 hover:text-green-600 border border-gray-200 hover:border-green-300 rounded px-2 py-1 transition-colors disabled:opacity-40">
                        {resolvingId === alert.id ? '…' : '標記已處理'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ══ 財務異常 ══ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">財務異常</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              毛利率異常、PO 缺失、AP 金額空白等規則型偵測（近 60 張出貨單）
            </p>
          </div>
          {visibleFinance.length > 0 && (
            <button onClick={dismissAllFinance} className="text-xs text-gray-400 hover:text-gray-600">全部略過</button>
          )}
        </div>

        {visibleFinance.length === 0 ? (
          <div className="bg-white border rounded-lg p-8 text-center text-gray-400 text-sm">
            目前沒有財務異常 ✓
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="divide-y">
              {visibleFinance.map(a => (
                <div key={a.shipmentId} className="px-4 py-3 group hover:bg-gray-50">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{a.level === 'error' ? '🔴' : '🟡'}</span>
                    <Link href={`/${orgSlug}/shipments/${a.shipmentId}`}
                      className="font-mono font-medium text-sm text-blue-600 hover:underline">
                      {a.shipmentNo}
                    </Link>
                    {a.grossPct != null && (
                      <span className={`text-xs font-mono ${a.grossPct > 55 || a.grossPct < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        毛利率 {a.grossPct.toFixed(1)}%
                      </span>
                    )}
                    <button onClick={() => dismissFinance(a.shipmentId)}
                      className="ml-auto text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                      略過
                    </button>
                  </div>
                  {a.issues.map((issue, i) => (
                    <p key={i} className="text-xs text-gray-500 pl-6 leading-snug">{issue}</p>
                  ))}
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-gray-100">
              {!summary && !analyzing && (
                <button onClick={analyze} className="text-xs py-1.5 px-3 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium">
                  ✨ AI 分析原因與建議
                </button>
              )}
              {analyzing && <p className="text-xs text-gray-400 animate-pulse">AI 分析中…</p>}
              {analyzeError && <p className="text-xs text-red-500">{analyzeError}</p>}
              {summary && <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{summary}</div>}
            </div>
          </div>
        )}
        {financeErrorCount > 0 && (
          <p className="text-xs text-gray-400">{financeErrorCount} 筆為高優先（毛利率明顯偏高或為負）</p>
        )}
      </div>
    </div>
  )
}
