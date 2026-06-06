'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewTenantPage() {
  const router  = useRouter()
  const [email,   setEmail]   = useState('')
  const [company, setCompany] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), company: company.trim() }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) { setError(data.error ?? '發生錯誤'); return }
    router.push('/admin/tenants')
    router.refresh()
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="font-semibold text-gray-800 mb-4">手動開通新租戶</h2>
        <p className="text-sm text-gray-500 mb-6">
          跳過付款流程，直接建立 Neon DB 並開通帳號。適用於內測用戶或特殊合作。
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">公司名稱</label>
            <input type="text" value={company} onChange={e => setCompany(e.target.value)} required
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
              {loading ? '開通中（約30秒）…' : '立即開通'}
            </button>
            <button type="button" onClick={() => router.back()}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
