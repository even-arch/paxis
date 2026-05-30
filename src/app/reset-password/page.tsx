'use client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

function ResetPasswordForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('密碼至少 8 個字元'); return }
    if (password !== confirm) { setError('兩次輸入的密碼不一致'); return }

    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })

    setLoading(false)

    if (!res.ok) {
      const d = await res.json() as { error?: string }
      setError(d.error ?? '重設失敗，請重新申請')
      return
    }

    setDone(true)
    setTimeout(() => router.push('/login'), 2500)
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-red-500 text-sm mb-4">無效的連結</p>
        <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">重新申請</Link>
      </div>
    )
  }

  return done ? (
    <div className="text-center space-y-3">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
        密碼已重設成功，即將跳轉至登入頁…
      </div>
      <Link href="/login" className="text-sm text-blue-600 hover:underline">立即前往登入</Link>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">新密碼</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="至少 8 個字元" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">確認新密碼</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
        {loading ? '重設中…' : '重設密碼'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-lg font-bold text-gray-800 mb-1">重設密碼</h1>
        <p className="text-sm text-gray-500 mb-6">請輸入您的新密碼。</p>
        <Suspense fallback={<p className="text-sm text-gray-400">載入中…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
