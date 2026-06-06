'use client'
import { useState } from 'react'

export default function UpsForm({
  tenantId,
  initialMode,
  initialAccountNo,
}: {
  tenantId: number
  initialMode: 'managed' | 'own'
  initialAccountNo: string | null
}) {
  const [mode,      setMode]      = useState<'managed' | 'own'>(initialMode)
  const [accountNo, setAccountNo] = useState(initialAccountNo ?? '')
  const [loading,   setLoading]   = useState(false)
  const [msg,       setMsg]       = useState('')
  const [err,       setErr]       = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMsg(''); setErr('')
    if (mode === 'own' && !accountNo.trim()) {
      setErr('請輸入 UPS Account Number')
      return
    }
    setLoading(true)
    const res = await fetch(`/api/admin/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:      'set_ups',
        upsMode:     mode,
        upsAccountNo: mode === 'own' ? accountNo.trim() : null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setErr(data.error ?? `HTTP ${res.status}`); return }
    setMsg('已儲存')
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="upsMode"
            value="managed"
            checked={mode === 'managed'}
            onChange={() => setMode('managed')}
            className="accent-blue-600"
          />
          <span className="text-sm text-gray-700">
            代管（錫諾系統帳號）
            <span className="block text-xs text-gray-400">享有折扣費率，帳號不對外揭露</span>
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="upsMode"
            value="own"
            checked={mode === 'own'}
            onChange={() => setMode('own')}
            className="accent-blue-600"
          />
          <span className="text-sm text-gray-700">
            自有帳號
            <span className="block text-xs text-gray-400">使用租戶自己的 UPS Account</span>
          </span>
        </label>
      </div>

      {mode === 'own' && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">UPS Account Number</label>
          <input
            type="text"
            value={accountNo}
            onChange={e => setAccountNo(e.target.value)}
            className="w-48 border border-gray-300 rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="6 位英數字"
          />
        </div>
      )}

      {err && <p className="text-xs text-red-500">{err}</p>}
      {msg && <p className="text-xs text-green-600">{msg}</p>}

      <button
        type="submit"
        disabled={loading}
        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? '儲存中…' : '儲存'}
      </button>
    </form>
  )
}
