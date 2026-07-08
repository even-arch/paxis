'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useOrgPath } from '@/lib/use-org-path'

type Notice = {
  id: number
  noticeNo: string
  status: string
  supplier: { id: number; name: string; shortName: string | null; email: string | null }
  items: { id: number }[]
}

const STATUS_LABEL: Record<string, string> = { DRAFT: '草稿', SENT: '已寄送', CONFIRMED: '已確認' }
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-green-100 text-green-700',
}

export default function ShippingNoticePanel({ shipmentId }: { shipmentId: number }) {
  const orgPath = useOrgPath()
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/shipping-notices`)
      if (res.ok) {
        const data = await res.json()
        setNotices(data.notices ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [shipmentId])

  useEffect(() => { load() }, [load])

  async function generate() {
    setGenerating(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/shipping-notices`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '產生失敗')
      const parts: string[] = []
      if (data.created?.length) parts.push(`已產生 ${data.created.length} 張通知單`)
      if (data.skipped?.length) parts.push(`${data.skipped.length} 個供應商跳過（${data.skipped.map((s: { supplierName: string; reason: string }) => `${s.supplierName}：${s.reason}`).join('、')}）`)
      setMessage(parts.join('；') || '沒有可產生的通知單')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '產生失敗')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">出貨通知單（通知供應商出貨）</h2>
        <button
          onClick={generate}
          disabled={generating}
          className="text-xs px-3 py-1.5 rounded border border-purple-300 text-purple-700 hover:bg-purple-50 disabled:opacity-50">
          {generating ? '產生中...' : '📋 依供應商產生通知單'}
        </button>
      </div>

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      {message && <p className="text-xs text-green-600 mb-2">{message}</p>}

      {loading ? (
        <p className="text-xs text-gray-400">載入中...</p>
      ) : notices.length === 0 ? (
        <p className="text-xs text-gray-400">
          尚未產生通知單。按上方按鈕，系統會把此出貨單關聯的 PO 依供應商分組，各自產生一張出貨通知單（草稿），檢查後即可 Email 寄出。
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {notices.map(n => (
            <Link
              key={n.id}
              href={orgPath(`/purchases/shipping-notices/${n.id}`)}
              className="flex items-center gap-3 py-2 hover:bg-gray-50 -mx-2 px-2 rounded">
              <span className="font-mono text-xs text-blue-600">{n.noticeNo}</span>
              <span className="text-sm text-gray-700">{n.supplier.shortName ?? n.supplier.name}</span>
              <span className="text-xs text-gray-400">{n.items.length} 品項</span>
              {!n.supplier.email && <span className="text-xs text-amber-500">⚠ 供應商無 Email</span>}
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[n.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABEL[n.status] ?? n.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
