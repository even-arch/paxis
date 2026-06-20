'use client'

import { useEffect, useState, useCallback } from 'react'

type SyncJob = {
  id: number
  status: string
  phase1Total: number
  phase1Done: number
  phase2Step: string | null
  startedAt: string
}

const PHASE2_STEPS = [
  'customers', 'suppliers', 'products',
  'sls_orders', 'po_orders', 'po_supplier_pis',
  'sls_pis', 'sls_shipments',
]

const PHASE2_LABELS: Record<string, string> = {
  customers:       '客戶主檔',
  suppliers:       '供應商主檔',
  products:        '產品主檔',
  sls_orders:      '客戶訂單',
  po_orders:       '採購訂單',
  po_supplier_pis: '供應商 PI',
  sls_pis:         '我方 PI',
  sls_shipments:   '出貨單',
}

function calcPercent(job: SyncJob): number {
  const isRunning = ['phase1', 'phase2', 'running', 'pending'].includes(job.status)
  if (!isRunning) return 100

  // Phase 1: 0–50%
  if (job.status === 'phase1' || (!job.phase2Step && job.phase1Total > 0)) {
    const p1 = job.phase1Total > 0 ? job.phase1Done / job.phase1Total : 0
    return Math.round(p1 * 50)
  }

  // Phase 2: 50–100%
  const stepIdx = job.phase2Step ? PHASE2_STEPS.indexOf(job.phase2Step) : -1
  const p2 = stepIdx >= 0 ? stepIdx / PHASE2_STEPS.length : 0
  return Math.round(50 + p2 * 50)
}

function elapsedLabel(startedAt: string): string {
  const sec = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

export default function SyncStatusBanner() {
  const [job, setJob] = useState<SyncJob | null>(null)
  const [tick, setTick] = useState(0)

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/patisco/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'status' }),
      })
      if (!res.ok) return
      const data = await res.json()
      const latest: SyncJob | undefined = data.jobs?.[0]
      if (latest && ['phase1', 'phase2', 'running', 'pending'].includes(latest.status)) {
        setJob(latest)
      } else {
        setJob(null)
      }
    } catch { /* 不顯示錯誤，下次 poll 再試 */ }
  }, [])

  useEffect(() => {
    poll()
    const interval = setInterval(() => {
      poll()
      setTick(t => t + 1)   // 觸發 elapsed re-render
    }, 3000)
    return () => clearInterval(interval)
  }, [poll])

  if (!job) return null

  const pct = calcPercent(job)
  const stepLabel = job.phase2Step ? PHASE2_LABELS[job.phase2Step] ?? job.phase2Step : null
  const phaseLabel = job.status === 'phase1'
    ? `第一階段：下載文件${job.phase1Total > 0 ? ` (${job.phase1Done} / ${job.phase1Total})` : ''}`
    : stepLabel
      ? `第二階段：解析 ${stepLabel}`
      : '準備中…'

  return (
    <div className="bg-blue-600 text-white text-sm px-4 py-2.5 select-none">
      <div className="flex items-center justify-between mb-1.5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-3.5 w-3.5 text-blue-200 flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="font-medium">Patisco 同步中</span>
          <span className="text-blue-200 text-xs">{phaseLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-blue-200 text-xs">{elapsedLabel(job.startedAt)}</span>
          <span className="font-mono text-xs bg-blue-700 px-2 py-0.5 rounded">{pct}%</span>
        </div>
      </div>
      {/* 進度條 */}
      <div className="max-w-7xl mx-auto">
        <div className="h-1.5 bg-blue-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {/* 操作警示 */}
      <div className="max-w-7xl mx-auto mt-1 text-xs text-blue-200">
        同步進行中，請勿新增或修改單據，以免資料衝突。
      </div>
    </div>
  )
}
