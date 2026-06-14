'use client'
import { useState, useEffect } from 'react'

interface EmailConfig {
  configured: boolean
  apiKeySet: boolean
  apiKeyHint: string
  fromEmail: string
  fromName: string
  lastTestedAt: string | null
  lastTestStatus: string | null
  lastTestMsg: string | null
}

export default function EmailConfigForm() {
  const [config, setConfig] = useState<EmailConfig | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [fromName, setFromName] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [testTo, setTestTo] = useState('')
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings/email').then(r => r.json()).then((d: EmailConfig) => {
      setConfig(d)
      if (d.configured) {
        setFromEmail(d.fromEmail ?? '')
        setFromName(d.fromName ?? '')
      }
    })
  }, [])

  async function save() {
    setSaving(true); setMsg(null)
    const res = await fetch('/api/settings/email', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, fromEmail, fromName }),
    })
    setSaving(false)
    if (res.ok) {
      setMsg({ type: 'ok', text: '已儲存' })
      setApiKey('')
      const d: EmailConfig = await fetch('/api/settings/email').then(r => r.json())
      setConfig(d)
    } else {
      const d = await res.json() as { error?: string }
      setMsg({ type: 'err', text: d.error ?? '儲存失敗' })
    }
  }

  async function remove() {
    if (!confirm('確定移除 Resend 設定？')) return
    await fetch('/api/settings/email', { method: 'DELETE' })
    setConfig({ configured: false, apiKeySet: false, apiKeyHint: '', fromEmail: '', fromName: '', lastTestedAt: null, lastTestStatus: null, lastTestMsg: null })
    setFromEmail(''); setFromName('')
    setMsg({ type: 'ok', text: '已移除' })
  }

  async function test() {
    if (!testTo) return
    setTesting(true); setTestMsg(null)
    const res = await fetch('/api/settings/email/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: testTo }),
    })
    setTesting(false)
    if (res.ok) {
      setTestMsg({ type: 'ok', text: `測試信已寄出至 ${testTo}，請查收。` })
    } else {
      const d = await res.json() as { error?: string }
      setTestMsg({ type: 'err', text: d.error ?? '寄送失敗' })
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* 說明 */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm text-orange-800">
        <p className="font-medium mb-1">關於 Resend</p>
        <p>
          在 <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline">resend.com</a> 免費註冊，
          驗證您的網域後取得 API Key。免費方案每月 3,000 封，足夠日常使用。
          寄信費用由您自己的 Resend 帳號承擔。
        </p>
      </div>

      {/* 設定表單 */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Resend API Key
            {config?.apiKeySet && (
              <span className="ml-2 text-xs text-gray-400 font-normal">目前：{config.apiKeyHint}</span>
            )}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={config?.apiKeySet ? '輸入新 Key 以覆蓋，或留空保留現有 Key' : 're_xxxxxxxxxxxxxxxxxxxxxxxx'}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">發件 Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={fromEmail}
              onChange={e => setFromEmail(e.target.value)}
              placeholder="no-reply@yourdomain.com"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">需已在 Resend 驗證的網域</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">發件人名稱</label>
            <input
              value={fromName}
              onChange={e => setFromName(e.target.value)}
              placeholder="Point Asia"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        {msg && (
          <p className={`text-sm ${msg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>
        )}

        <div className="flex gap-3">
          <button onClick={save} disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? '儲存中…' : '儲存'}
          </button>
          {config?.configured && (
            <button onClick={remove}
              className="border border-red-300 text-red-600 px-4 py-2 rounded-md text-sm hover:bg-red-50">
              移除
            </button>
          )}
        </div>
      </div>

      {/* 測試 */}
      {config?.configured && config.apiKeySet && (
        <div className="border-t pt-5 space-y-3">
          <p className="text-sm font-medium text-gray-700">寄送測試信</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={testTo}
              onChange={e => setTestTo(e.target.value)}
              placeholder="收件 Email"
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <button onClick={test} disabled={testing || !testTo}
              className="bg-gray-800 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-700 disabled:opacity-50">
              {testing ? '寄送中…' : '測試'}
            </button>
          </div>
          {testMsg && (
            <p className={`text-sm ${testMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{testMsg.text}</p>
          )}
          {config.lastTestedAt && (
            <p className="text-xs text-gray-400">
              上次測試：{new Date(config.lastTestedAt).toLocaleString('zh-TW')}
              {' · '}
              <span className={config.lastTestStatus === 'ok' ? 'text-green-500' : 'text-red-500'}>
                {config.lastTestStatus === 'ok' ? '成功' : `失敗：${config.lastTestMsg}`}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
