'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Status = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'DELETED'

export default function TenantActions({
  id, status, hasDb, allowDelete = false
}: { id: number; status: Status; hasDb: boolean; allowDelete?: boolean }) {
  const router  = useRouter()
  const [loading, setLoading]   = useState(false)
  const [err,     setErr]       = useState('')
  const [pwMode,  setPwMode]    = useState(false)
  const [newPw,   setNewPw]     = useState('')
  const [pwMsg,   setPwMsg]     = useState('')

  async function action(type: string, extra?: Record<string, string>): Promise<boolean> {
    setErr('')
    setLoading(true)
    try {
      const res  = await fetch(`/api/admin/tenants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: type, ...extra }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoading(false)
        setErr(data.error ?? `HTTP ${res.status}`)
        return false
      }
      return true
    } catch (e) {
      setLoading(false)
      setErr('網路錯誤，請稍後再試')
      return false
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg('')
    setErr('')
    setLoading(true)
    const res = await fetch(`/api/admin/tenants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_password', password: newPw }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setErr(data.error ?? `HTTP ${res.status}`); return }
    setPwMsg('密碼已更新')
    setNewPw('')
    setPwMode(false)
  }

  if (loading) return <span className="text-xs text-gray-400 animate-pulse">處理中，請稍候…</span>

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap items-center">
        {err && <span className="text-xs text-red-500">{err}</span>}
        {pwMsg && <span className="text-xs text-green-600">{pwMsg}</span>}
        {status === 'PENDING' && !hasDb && (
          <button onClick={() => action('provision').then(ok => ok && window.location.reload())}
            className="text-xs text-white bg-green-600 hover:bg-green-700 px-2 py-1 rounded">
            手動開通
          </button>
        )}
        {status === 'ACTIVE' && (
          <button onClick={() => action('suspend').then(ok => ok && window.location.reload())}
            className="text-xs text-red-600 hover:underline">
            停用
          </button>
        )}
        {status === 'SUSPENDED' && (
          <button onClick={() => action('activate').then(ok => ok && window.location.reload())}
            className="text-xs text-green-600 hover:underline">
            重新啟用
          </button>
        )}
        <button onClick={() => { setPwMode(v => !v); setPwMsg(''); setErr('') }}
          className="text-xs text-blue-600 hover:underline">
          設定密碼
        </button>
        {allowDelete && status !== 'DELETED' && (
          <button onClick={() => {
            if (!confirm('確定要刪除此租戶？此操作無法復原。')) return
            action('delete').then(() => router.push('/admin/tenants'))
          }}
            className="text-xs text-red-400 hover:text-red-600 hover:underline ml-auto">
            刪除租戶
          </button>
        )}
      </div>

      {pwMode && (
        <form onSubmit={handleSetPassword} className="flex items-center gap-2 mt-1">
          <input
            type="password"
            minLength={8}
            required
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            placeholder="新密碼（至少 8 字元）"
            className="border border-gray-300 rounded px-2 py-1 text-xs w-48 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button type="submit"
            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">
            確認
          </button>
          <button type="button" onClick={() => setPwMode(false)}
            className="text-xs text-gray-400 hover:text-gray-600">
            取消
          </button>
        </form>
      )}
    </div>
  )
}
