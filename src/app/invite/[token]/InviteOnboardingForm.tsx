'use client'

import { useState } from 'react'

export default function InviteOnboardingForm({
  token,
  defaultEmail,
}: {
  token: string
  defaultEmail: string
}) {
  const [form, setForm] = useState({
    companyName: '',
    slug: '',
    adminEmail: defaultEmail,
    adminPassword: '',
    adminPasswordConfirm: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  function set(field: string, value: string) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // auto-generate slug from company name
      if (field === 'companyName' && !prev.slug) {
        next.slug = value
          .toLowerCase()
          .replace(/\s+/g, '')
          .replace(/[^a-z0-9-]/g, '')
          .slice(0, 30)
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.adminPassword !== form.adminPasswordConfirm) {
      setError('兩次密碼輸入不一致')
      return
    }
    if (form.adminPassword.length < 8) {
      setError('密碼至少 8 個字元')
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch(`/api/invite/${token}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: form.companyName,
        slug: form.slug,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
      }),
    })
    setLoading(false)
    if (res.ok) {
      setDone(true)
    } else {
      const data = await res.json()
      setError(data.error ?? '提交失敗，請稍後再試')
    }
  }

  if (done) {
    return (
      <div className="text-center space-y-3">
        <div className="text-4xl">✅</div>
        <p className="font-semibold text-gray-800">申請已送出！</p>
        <p className="text-sm text-gray-500">
          我們已收到您的申請，管理員將在審核後以 Email 通知您開通結果。
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">公司名稱</label>
        <input
          value={form.companyName}
          onChange={e => set('companyName', e.target.value)}
          required
          placeholder="例：台灣貿易有限公司"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          系統識別碼（Slug）
          <span className="text-gray-400 font-normal ml-1">— 用於網址，只能含英數字與連字號</span>
        </label>
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-400">paxis.tw/</span>
          <input
            value={form.slug}
            onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            required
            pattern="[a-z0-9-]+"
            placeholder="company-name"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">管理員 Email</label>
        <input
          type="email"
          value={form.adminEmail}
          onChange={e => set('adminEmail', e.target.value)}
          required
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">密碼</label>
        <input
          type="password"
          value={form.adminPassword}
          onChange={e => set('adminPassword', e.target.value)}
          required
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">確認密碼</label>
        <input
          type="password"
          value={form.adminPasswordConfirm}
          onChange={e => set('adminPasswordConfirm', e.target.value)}
          required
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? '提交中...' : '送出申請'}
      </button>
    </form>
  )
}
