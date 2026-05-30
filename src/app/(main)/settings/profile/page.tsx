'use client'
import { useState, useEffect } from 'react'

interface Profile { id: number; name: string; loginId: string }

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then((d: Profile) => {
      setProfile(d)
      setName(d.name)
      setEmail(d.loginId)
    })
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (newPw && newPw !== confirmPw) {
      setMsg({ type: 'err', text: '兩次輸入的新密碼不一致' })
      return
    }
    setSaving(true)
    setMsg(null)

    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        currentPassword: currentPw || undefined,
        newPassword: newPw || undefined,
      }),
    })

    setSaving(false)
    const d = await res.json() as { error?: string }
    if (res.ok) {
      setMsg({ type: 'ok', text: '已儲存。若有更改 Email，請用新 Email 重新登入。' })
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setProfile(prev => prev ? { ...prev, name, loginId: email } : prev)
    } else {
      setMsg({ type: 'err', text: d.error ?? '儲存失敗' })
    }
  }

  if (!profile) return <div className="p-6 text-sm text-gray-400">載入中…</div>

  return (
    <div className="p-6 max-w-md">
      <h1 className="text-xl font-semibold mb-1">個人設定</h1>
      <p className="text-sm text-gray-500 mb-6">管理您的帳號資訊與密碼。</p>

      <form onSubmit={save} className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">帳號資訊</h2>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">姓名</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className={inp} placeholder="顯示名稱" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email（登入帳號）</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className={inp} placeholder="you@example.com" required />
            <p className="text-xs text-gray-400 mt-1">變更 Email 後需用新 Email 重新登入</p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">變更密碼</h2>
          <p className="text-xs text-gray-400">若不需變更密碼，請留空。</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">目前密碼</label>
            <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
              className={inp} autoComplete="current-password" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">新密碼（至少 8 字元）</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
              className={inp} autoComplete="new-password" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">確認新密碼</label>
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
              className={inp} autoComplete="new-password" />
          </div>
        </section>

        {msg && (
          <p className={`text-sm ${msg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>
        )}

        <button type="submit" disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? '儲存中…' : '儲存'}
        </button>
      </form>
    </div>
  )
}

const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
