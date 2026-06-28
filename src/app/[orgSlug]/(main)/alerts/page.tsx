'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

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

export default function AlertsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const [alerts, setAlerts] = useState<DataAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [rescanLoading, setRescanLoading] = useState(false)
  const [rescanResult, setRescanResult] = useState<string | null>(null)
  const [resolvingId, setResolvingId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/data-alerts')
      const data = await res.json()
      setAlerts(data.alerts ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function resolve(id: number) {
    setResolvingId(id)
    try {
      const res = await fetch(`/api/data-alerts/${id}`, { method: 'PATCH' })
      if (res.ok) setAlerts(prev => prev.filter(a => a.id !== id))
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
      setRescanResult(`清除了 ${data.cleaned} 筆過期警示（共掃描 ${data.total} 筆）`)
      await load()
    } finally {
      setRescanLoading(false)
    }
  }

  // Group by type
  const grouped = alerts.reduce<Record<string, DataAlert[]>>((acc, a) => {
    ;(acc[a.type] ??= []).push(a)
    return acc
  }, {})

  const typeOrder = ['PI_CONFLICT', 'MISSING_PI', 'WORKFLOW_GAP', 'UNLINKED_ITEM']
  const sortedTypes = [
    ...typeOrder.filter(t => grouped[t]),
    ...Object.keys(grouped).filter(t => !typeOrder.includes(t)),
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-5 py-2">
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
            {rescanLoading ? '掃描中…' : '清除過期警示'}
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
        <div className="bg-white border rounded-lg p-10 text-center text-gray-400 text-sm">
          目前沒有未處理的資料警示
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
                      {alert.detail && Object.keys(alert.detail).length > 0 && (
                        <p className="text-xs text-gray-400 font-mono truncate">
                          {JSON.stringify(alert.detail)}
                        </p>
                      )}
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
  )
}
