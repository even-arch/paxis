'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardingForm({ orgSlug }: { orgSlug: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nameZh: '',
    nameEn: '',
    shortName: '',
    taxId: '',
    phone: '',
    email: '',
  })

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nameZh.trim() && !form.nameEn.trim()) {
      setError('請至少填寫中文或英文公司名稱')
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch('/api/setup/company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) {
      router.push(`/${orgSlug}/dashboard`)
    } else {
      const data = await res.json()
      setError(data.error ?? '儲存失敗，請再試一次')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            公司名稱（中文）<span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            type="text"
            value={form.nameZh}
            onChange={set('nameZh')}
            placeholder="例：錫諾系統有限公司"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">須與 Patisco 文件中的公司名稱一致，系統才能正確識別文件歸屬</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            公司名稱（英文）
          </label>
          <input
            type="text"
            value={form.nameEn}
            onChange={set('nameEn')}
            placeholder="例：Xinosys Co., Ltd."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            公司簡稱
          </label>
          <input
            type="text"
            value={form.shortName}
            onChange={set('shortName')}
            placeholder="例：錫諾（顯示在系統側邊欄）"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">統一編號</label>
            <input
              type="text"
              value={form.taxId}
              onChange={set('taxId')}
              placeholder="12345678"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">聯絡電話</label>
            <input
              type="text"
              value={form.phone}
              onChange={set('phone')}
              placeholder="+886-2-1234-5678"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">公司 Email</label>
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="info@yourcompany.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? '儲存中...' : '完成設定，開始使用 →'}
      </button>
    </form>
  )
}
