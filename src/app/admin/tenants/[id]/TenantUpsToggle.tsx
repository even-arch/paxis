'use client'

import { useState } from 'react'

export default function TenantUpsToggle({
  tenantId,
  initialEnabled,
}: {
  tenantId: number
  initialEnabled: boolean
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function toggle() {
    setLoading(true); setMsg('')
    const next = !enabled
    const res = await fetch(`/api/admin/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_ups', upsMode: next ? 'managed' : 'disabled' }),
    })
    setLoading(false)
    if (res.ok) {
      setEnabled(next)
      setMsg(next ? '已開通平台 UPS 代管' : '已關閉平台 UPS 代管')
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string }
      setMsg(d.error ?? '操作失敗')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
            enabled ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
        <span className="text-sm text-gray-700">
          {enabled ? '已開通（租戶可使用平台 UPS）' : '未開通（租戶無法使用平台 UPS）'}
        </span>
      </div>
      {msg && <p className="text-xs text-gray-500">{msg}</p>}
    </div>
  )
}
