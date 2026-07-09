'use client'

import { useState, useEffect } from 'react'

interface EmailConfig {
  hasApiKey: boolean
  apiKeyHint: string | null
  from: string
  hasEnvKey: boolean
}

export default function EmailForm() {
  const [config, setConfig] = useState<EmailConfig | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [from, setFrom] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/admin/settings/email')
      .then(r => r.json())
      .then((d: EmailConfig) => {
        setConfig(d)
        setFrom(d.from)
      })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    try {
      const body: Record<string, string> = { from }
      if (apiKey.trim()) body.apiKey = apiKey.trim()

      const res = await fetch('/api/admin/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '儲存失敗')
      setMsg({ type: 'ok', text: '已儲存' })
      setApiKey('')
      // 重新讀取狀態
      const updated: EmailConfig = await fetch('/api/admin/settings/email').then(r => r.json())
      setConfig(updated)
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : '儲存失敗' })
    } finally {
      setSaving(false)
    }
  }

  if (!config) return <div className="text-sm text-gray-400">載入中…</div>

  return (
    <form onSubmit={handleSave} className="space-y-6">

      {/* 目前狀態 */}
      <div className={`rounded-lg border px-4 py-3 text-sm ${
        config.hasApiKey
          ? 'bg-green-50 border-green-200 text-green-800'
          : config.hasEnvKey
            ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
            : 'bg-red-50 border-red-200 text-red-700'
      }`}>
        {config.hasApiKey
          ? `✅ 使用 DB 設定（${config.apiKeyHint}）`
          : config.hasEnvKey
            ? '⚠️ 目前使用環境變數 SYSTEM_RESEND_API_KEY（未在此頁設定）'
            : '❌ 尚未設定，邀請信無法寄出'}
      </div>

      {/* Resend API Key */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Resend API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder={config.hasApiKey ? '留空保留現有 Key' : 're_xxxxxxxxxxxx'}
          className="w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400">
          至 <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">resend.com/api-keys</a> 取得。留空不修改現有 Key。
        </p>
      </div>

      {/* 寄件人 */}
      <div className="space-y-2 border-t pt-5">
        <label className="block text-sm font-medium text-gray-700">
          寄件人地址（From）
        </label>
        <input
          type="text"
          value={from}
          onChange={e => setFrom(e.target.value)}
          placeholder="PAXIS <noreply@paxis.tw>"
          className="w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400">
          格式：<code>顯示名稱 &lt;email@domain.com&gt;</code>。該 domain 需在 Resend 完成驗證。
        </p>
      </div>

      {msg && (
        <p className={`text-xs ${msg.type === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
          {msg.type === 'ok' ? '✅ ' : '❌ '}{msg.text}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? '儲存中…' : '儲存'}
      </button>
    </form>
  )
}
