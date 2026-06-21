'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ConfirmShipmentButton({ shipmentId, alreadyConfirmed }: {
  shipmentId: number
  alreadyConfirmed: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(alreadyConfirmed)
  const [error, setError] = useState('')

  if (done) {
    return <span className="text-xs text-green-600 font-medium">✓ 庫存已扣減</span>
  }

  async function handleConfirm() {
    if (!confirm('確認驅動出貨？系統將寫入庫存扣減（quantity--），此動作不可逆。')) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/confirm`, { method: 'POST' })
      const json = await res.json() as { ok?: boolean; confirmed?: number; skipped?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? '操作失敗')
      setDone(true)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleConfirm}
        disabled={loading}
        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {loading ? '處理中…' : '✈ 確認出貨（驅動庫存）'}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
