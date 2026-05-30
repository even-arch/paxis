'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ManualSyncButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function handleSync() {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/webhooks/patisco', { method: 'POST' })
      const data = await res.json()
      setMsg(`完成：處理 ${data.processed ?? 0} 張，跳過 ${data.skipped ?? 0} 張`)
      router.refresh()
    } catch {
      setMsg('同步失敗，請查看日誌')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSync}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? '同步中...' : '手動觸發同步'}
      </button>
      {msg && <p className="text-xs text-gray-500">{msg}</p>}
    </div>
  )
}
