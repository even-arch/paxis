'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'

export default function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [credError, setCredError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard'
  const [orgSlug, setOrgSlug] = useState(searchParams.get('org') ?? '')

  const errorMessage = credError
    ?? (error ? '登入失敗，請再試一次。' : null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCredError(null)
    setLoading(true)
    const res = await signIn('credentials', {
      email,
      password,
      orgSlug,
      callbackUrl,
      redirect: false,
    })
    setLoading(false)
    if (res?.error) {
      setCredError('Email 或密碼錯誤，請再試一次。')
    } else if (res?.url) {
      window.location.href = res.url
    }
  }

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">公司代碼</label>
          <input
            type="text"
            required
            value={orgSlug}
            onChange={e => setOrgSlug(e.target.value.toLowerCase().trim())}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例如：pointasia"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Email</label>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">密碼</label>
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-md px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? '登入中…' : '登入'}
        </button>
      </form>

      <p className="text-center text-xs text-gray-400">
        尚未開通？
        <a href="/signup" className="text-blue-500 hover:underline ml-1">申請使用</a>
      </p>
    </div>
  )
}
