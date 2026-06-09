'use client'

import { useState } from 'react'

export default function MarketplaceApiSettingsPage() {
  const [form, setForm] = useState({ apiKey: '', secretKey: '', saltKey: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const isComplete = form.apiKey.trim() && form.secretKey.trim() && form.saltKey.trim()

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!isComplete) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/marketplace/channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'RUTEN',
          label: '露天拍賣',
          ...form,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">API 憑證設定</h1>
        <p className="text-sm text-gray-500 mt-1">設定露天拍賣 Open Platform 的存取金鑰</p>
      </div>

      {/* 申請說明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 mb-6 space-y-1">
        <p className="font-medium">📋 申請步驟</p>
        <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
          <li>前往 <a href="https://www.ruten.com.tw/help/seller/11335/" target="_blank" rel="noreferrer" className="underline">露天 API 申請頁面</a></li>
          <li>填寫申請表，Webhook URL 請填入：<code className="bg-blue-100 px-1 rounded text-xs">https://paxis.tw/api/webhooks/ruten</code></li>
          <li>審核約 3 個工作天，通過後會收到 API Key、Secret Key、Salt Key</li>
          <li>收到後填入下方表單儲存</li>
        </ol>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {[
          {
            key: 'apiKey',
            label: 'API Key',
            placeholder: '露天 Open Platform 核發',
            desc: '用於標識你的 API 身份（X-RT-Key）',
          },
          {
            key: 'secretKey',
            label: 'Secret Key',
            placeholder: '露天 Open Platform 核發',
            desc: '用於 HMAC-SHA256 簽章，請勿外洩',
          },
          {
            key: 'saltKey',
            label: 'Salt Key',
            placeholder: '露天 Open Platform 核發',
            desc: '加入簽章的鹽值，露天專用',
          },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {f.label}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="password"
              autoComplete="off"
              placeholder={f.placeholder}
              value={form[f.key as keyof typeof form]}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono"
            />
            <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
          </div>
        ))}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            ❌ {error}
          </div>
        )}

        {saved && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
            ✅ 金鑰已儲存，系統準備就緒
          </div>
        )}

        <button
          type="submit"
          disabled={!isComplete || saving}
          className="w-full bg-orange-500 text-white py-2.5 rounded-lg text-sm font-medium
                     hover:bg-orange-600 active:bg-orange-700 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? '儲存中…' : '儲存設定'}
        </button>

        <p className="text-xs text-gray-400 text-center">
          金鑰會加密後儲存到資料庫，不會以明文記錄
        </p>
      </form>
    </div>
  )
}
