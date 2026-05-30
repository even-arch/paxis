'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [devUrl, setDevUrl] = useState('')  // dev 模式下顯示重設連結

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    setLoading(false)

    if (!res.ok) {
      const d = await res.json() as { error?: string }
      setError(d.error ?? '發生錯誤，請稍後再試')
      return
    }

    const d = await res.json() as { devResetUrl?: string }
    if (d.devResetUrl) setDevUrl(d.devResetUrl)
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-lg font-bold text-gray-800 mb-1">忘記密碼</h1>
        <p className="text-sm text-gray-500 mb-6">輸入您的 Email，我們會寄送重設連結給您。</p>

        {submitted ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
              若此 Email 有對應的帳號，重設連結已寄出，請查收信件。
            </div>
            {devUrl && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 break-all">
                <p className="font-medium mb-1">開發模式 — 重設連結：</p>
                <Link href={devUrl} className="underline">{devUrl}</Link>
              </div>
            )}
            <Link href="/login" className="block text-center text-sm text-blue-600 hover:underline">
              返回登入
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? '傳送中…' : '傳送重設連結'}
            </button>
            <Link href="/login" className="block text-center text-sm text-gray-400 hover:text-gray-600">
              返回登入
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
