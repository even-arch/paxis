'use client'
import { useState } from 'react'

export default function GeneralForm({
  initialAllowDelete,
}: {
  initialAllowDelete: boolean
}) {
  const [allowDelete, setAllowDelete] = useState(initialAllowDelete)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState('')
  const [err, setErr]         = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMsg(''); setErr('')
    setLoading(true)
    const res = await fetch('/api/admin/settings/general', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowTenantDelete: allowDelete }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setErr(data.error ?? `HTTP ${res.status}`); return }
    setMsg('已儲存')
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">❌ 儲存失敗：{err}</div>}
      {msg && <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded px-3 py-2">✅ {msg}</div>}

      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="allowDelete"
          checked={allowDelete}
          onChange={e => setAllowDelete(e.target.checked)}
          className="mt-0.5 accent-red-600"
        />
        <label htmlFor="allowDelete" className="cursor-pointer">
          <p className="text-sm font-medium text-gray-800">開放刪除租戶</p>
          <p className="text-xs text-gray-400 mt-0.5">
            啟用後，租戶詳情頁會出現「刪除租戶」按鈕（軟刪除，status → DELETED）。<br />
            正式上線前建議保持關閉。
          </p>
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? '儲存中…' : '儲存設定'}
      </button>
    </form>
  )
}
