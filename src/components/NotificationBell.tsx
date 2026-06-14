'use client'

import { useEffect, useRef, useState } from 'react'
import type { Alert } from '@/app/api/finance/alerts/route'

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

export default function NotificationBell() {
  const [allAlerts, setAllAlerts] = useState<Alert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDismissed(loadDismissed())
  }, [])

  // 靜默載入，不阻塞頁面
  useEffect(() => {
    fetch('/api/finance/alerts')
      .then(r => r.json())
      .then((d: { alerts: Alert[] }) => setAllAlerts(d.alerts ?? []))
      .catch(() => {/* 靜默失敗 */})
  }, [])

  function dismiss(shipmentId: number) {
    const next = new Set(dismissed)
    next.add(String(shipmentId))
    setDismissed(next)
    saveDismissed(next)
    setSummary(null)
  }

  function dismissAll() {
    const next = new Set(dismissed)
    allAlerts.forEach(a => next.add(String(a.shipmentId)))
    setDismissed(next)
    saveDismissed(next)
    setSummary(null)
  }

  const alerts = allAlerts.filter(a => !dismissed.has(String(a.shipmentId)))

  // 點外部關閉
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function analyze() {
    setAnalyzing(true)
    setSummary(null)
    setAnalyzeError(null)
    try {
      const res = await fetch('/api/finance/alerts/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alerts }),
      })
      const d = await res.json() as { summary?: string; error?: string }
      if (d.error) setAnalyzeError(d.error)
      else setSummary(d.summary ?? '')
    } catch {
      setAnalyzeError('分析請求失敗')
    } finally {
      setAnalyzing(false)
    }
  }

  const errorCount = alerts.filter(a => a.level === 'error').length
  const hasAlerts = alerts.length > 0

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-800 transition-colors"
        title={hasAlerts ? `${alerts.length} 個財務異常` : '無異常'}
      >
        {/* 鈴鐺圖示 */}
        <span className={hasAlerts ? 'animate-[wiggle_2s_ease-in-out_infinite]' : ''} style={{ display: 'inline-block' }}>
          🔔
        </span>
        {/* 紅點 badge */}
        {hasAlerts && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full text-[10px] font-bold leading-none bg-red-500 text-white">
            {errorCount > 0 ? errorCount : alerts.length}
          </span>
        )}
      </button>

      {/* 下拉 panel */}
      {open && (
        <div className="absolute left-0 top-10 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 text-gray-800 text-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-700">財務異常通知</span>
            {hasAlerts && (
              <button onClick={dismissAll} className="text-xs text-gray-400 hover:text-gray-600">
                全部略過
              </button>
            )}
          </div>

          {!hasAlerts && (
            <p className="px-4 py-5 text-center text-gray-400 text-xs">目前沒有發現異常 ✓</p>
          )}

          {hasAlerts && (
            <>
              <ul className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                {alerts.map(a => (
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
                      <button
                        onClick={() => dismiss(a.shipmentId)}
                        className="ml-auto text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
                        title="略過此項"
                      >✕</button>
                    </div>
                    {a.issues.map((issue, i) => (
                      <p key={i} className="text-xs text-gray-500 pl-6 leading-snug">{issue}</p>
                    ))}
                  </li>
                ))}
              </ul>

              {/* AI 分析區 */}
              <div className="px-4 py-3 border-t border-gray-100">
                {!summary && !analyzing && (
                  <button
                    onClick={analyze}
                    className="w-full text-xs py-1.5 px-3 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium"
                  >
                    ✨ AI 分析原因與建議
                  </button>
                )}
                {analyzing && (
                  <p className="text-xs text-center text-gray-400 animate-pulse">AI 分析中…</p>
                )}
                {analyzeError && (
                  <p className="text-xs text-red-500">{analyzeError}</p>
                )}
                {summary && (
                  <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {summary}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* wiggle keyframe */}
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
