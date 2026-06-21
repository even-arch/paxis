'use client'

import { useEffect, useRef, useState } from 'react'
import type { Alert as FinanceAlert } from '@/app/api/finance/alerts/route'

// ─── 資料品質告警型別 ──────────────────────────────────────────────

type DataAlert = {
  id: number
  type: string        // MISSING_PI | WORKFLOW_GAP | PI_CONFLICT
  refType: string
  refId: number | null
  refNo: string | null
  message: string
  detail: Record<string, unknown> | null
  createdAt: string
}

// ─── 財務告警（原有邏輯）─────────────────────────────────────────

const DISMISSED_KEY = 'paxis:dismissed-alerts'
function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}
function saveDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids)))
}

// ─── 告警類型標籤 ────────────────────────────────────────────────

const ALERT_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  MISSING_PI:   { label: '缺少 PI 品項',  color: 'text-amber-600' },
  WORKFLOW_GAP: { label: '流程缺口',      color: 'text-orange-600' },
  PI_CONFLICT:  { label: 'PI 衝突',       color: 'text-red-600' },
  AI_AUDIT:     { label: 'AI 缺口分析',   color: 'text-blue-600' },
}

export default function NotificationBell() {
  const [financeAlerts, setFinanceAlerts]   = useState<FinanceAlert[]>([])
  const [dataAlerts, setDataAlerts]         = useState<DataAlert[]>([])
  const [dismissed, setDismissed]           = useState<Set<string>>(new Set())
  const [open, setOpen]                     = useState(false)
  const [tab, setTab]                       = useState<'data' | 'finance'>('data')
  const [resolving, setResolving]           = useState<number | null>(null)
  const [analyzing, setAnalyzing]           = useState(false)
  const [summary, setSummary]               = useState<string | null>(null)
  const [analyzeError, setAnalyzeError]     = useState<string | null>(null)
  const [expandedAlert, setExpandedAlert]   = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setDismissed(loadDismissed()) }, [])

  function fetchAlerts() {
    fetch('/api/finance/alerts')
      .then(r => r.json())
      .then((d: { alerts: FinanceAlert[] }) => setFinanceAlerts(d.alerts ?? []))
      .catch(() => {})
    fetch('/api/data-alerts')
      .then(r => r.json())
      .then((d: { alerts: DataAlert[] }) => setDataAlerts(d.alerts ?? []))
      .catch(() => {})
  }

  // 頁面載入時拉一次
  useEffect(() => { fetchAlerts() }, [])

  // 開啟面板時重新拉
  useEffect(() => { if (open) fetchAlerts() }, [open])

  // 每 5 分鐘自動重新偵測（sync 後告警可能已消失）
  useEffect(() => {
    const timer = setInterval(fetchAlerts, 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function resolveDataAlert(id: number) {
    setResolving(id)
    try {
      await fetch(`/api/data-alerts/${id}`, { method: 'PATCH' })
      setDataAlerts(prev => prev.filter(a => a.id !== id))
    } finally {
      setResolving(null)
    }
  }

  async function resolveAllDataAlerts() {
    setResolving(-1)
    try {
      await Promise.all(dataAlerts.map(a => fetch(`/api/data-alerts/${a.id}`, { method: 'PATCH' })))
      setDataAlerts([])
    } finally {
      setResolving(null)
    }
  }

  function dismiss(shipmentId: number) {
    const next = new Set(dismissed)
    next.add(String(shipmentId))
    setDismissed(next)
    saveDismissed(next)
    setSummary(null)
  }

  function dismissAll() {
    const next = new Set(dismissed)
    financeAlerts.forEach(a => next.add(String(a.shipmentId)))
    setDismissed(next)
    saveDismissed(next)
    setSummary(null)
  }

  const visibleFinance = financeAlerts.filter(a => !dismissed.has(String(a.shipmentId)))
  const totalCount = dataAlerts.length + visibleFinance.filter(a => a.level === 'error').length

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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-800 transition-colors"
        title={totalCount > 0 ? `${totalCount} 個待處理告警` : '無告警'}
      >
        <span className={totalCount > 0 ? 'animate-[wiggle_2s_ease-in-out_infinite]' : ''} style={{ display: 'inline-block' }}>
          🔔
        </span>
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full text-[10px] font-bold leading-none bg-red-500 text-white">
            {totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-10 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 text-gray-800 text-sm">
          {/* Tab 切換 */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setTab('data')}
              className={`flex-1 px-4 py-2.5 text-xs font-medium ${tab === 'data' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              資料品質 {dataAlerts.length > 0 && <span className="ml-1 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{dataAlerts.length}</span>}
            </button>
            <button
              onClick={() => setTab('finance')}
              className={`flex-1 px-4 py-2.5 text-xs font-medium ${tab === 'finance' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              財務異常 {visibleFinance.filter(a => a.level === 'error').length > 0 && (
                <span className="ml-1 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{visibleFinance.filter(a => a.level === 'error').length}</span>
              )}
            </button>
          </div>

          {/* 資料品質 Tab */}
          {tab === 'data' && (
            <>
              {dataAlerts.length === 0 ? (
                <p className="px-4 py-5 text-center text-gray-400 text-xs">沒有資料品質問題 ✓</p>
              ) : (
                <>
                <div className="px-4 py-2 border-b border-gray-50 flex justify-between items-center">
                  <button onClick={fetchAlerts} className="text-xs text-gray-400 hover:text-gray-600">↻ 重新偵測</button>
                  <button onClick={resolveAllDataAlerts} disabled={resolving === -1} className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50">全部標記已知</button>
                </div>
                <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {dataAlerts.map(alert => {
                    const typeInfo = ALERT_TYPE_LABEL[alert.type] ?? { label: alert.type, color: 'text-gray-600' }
                    const hint = (alert.detail as { hint?: string } | null)?.hint
                    const isExpanded = expandedAlert === alert.id
                    return (
                      <li key={alert.id} className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 text-amber-500 shrink-0">⚠</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={`text-[10px] font-semibold uppercase tracking-wide ${typeInfo.color}`}>{typeInfo.label}</span>
                              {alert.refNo && <span className="font-mono text-xs text-gray-500">{alert.refNo}</span>}
                            </div>
                            <p className="text-xs text-gray-700 leading-snug">{alert.message}</p>
                            {hint && isExpanded && (
                              <p className="mt-1.5 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1.5 leading-relaxed">{hint}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2 pl-6">
                          <button
                            onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            {isExpanded ? '收起' : '查看建議 →'}
                          </button>
                          <button
                            onClick={() => resolveDataAlert(alert.id)}
                            disabled={resolving === alert.id}
                            className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50 ml-auto"
                          >
                            {resolving === alert.id ? '處理中…' : '標記已知'}
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                </>
              )}
            </>
          )}

          {/* 財務異常 Tab */}
          {tab === 'finance' && (
            <>
              {visibleFinance.length === 0 ? (
                <p className="px-4 py-5 text-center text-gray-400 text-xs">目前沒有財務異常 ✓</p>
              ) : (
                <>
                  <div className="px-4 py-2 border-b border-gray-50 flex justify-end">
                    <button onClick={dismissAll} className="text-xs text-gray-400 hover:text-gray-600">全部略過</button>
                  </div>
                  <ul className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                    {visibleFinance.map(a => (
                      <li key={a.shipmentId} className="px-4 py-2.5 group">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={a.level === 'error' ? 'text-red-500' : 'text-amber-500'}>
                            {a.level === 'error' ? '🔴' : '🟡'}
                          </span>
                          <span className="font-mono font-medium text-xs">{a.shipmentNo}</span>
                          {a.grossPct != null && (
                            <span className={`text-xs font-mono ${a.grossPct > 55 || a.grossPct < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                              {a.grossPct.toFixed(1)}%
                            </span>
                          )}
                          <button onClick={() => dismiss(a.shipmentId)} className="ml-auto text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                        </div>
                        {a.issues.map((issue, i) => (
                          <p key={i} className="text-xs text-gray-500 pl-6 leading-snug">{issue}</p>
                        ))}
                      </li>
                    ))}
                  </ul>
                  <div className="px-4 py-3 border-t border-gray-100">
                    {!summary && !analyzing && (
                      <button onClick={analyze} className="w-full text-xs py-1.5 px-3 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium">
                        ✨ AI 分析原因與建議
                      </button>
                    )}
                    {analyzing && <p className="text-xs text-center text-gray-400 animate-pulse">AI 分析中…</p>}
                    {analyzeError && <p className="text-xs text-red-500">{analyzeError}</p>}
                    {summary && <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">{summary}</div>}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes wiggle {
          0%, 90%, 100% { transform: rotate(0deg); }
          92% { transform: rotate(-12deg); }
          96% { transform: rotate(12deg); }
        }
      `}</style>
    </div>
  )
}
