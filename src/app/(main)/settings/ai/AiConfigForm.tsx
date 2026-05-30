'use client'
import { useState, useEffect } from 'react'

interface AiConfig {
  aiProvider: string
  apiKeySet: boolean
  apiKeyHint: string
}

export default function AiConfigForm() {
  const [config, setConfig] = useState<AiConfig | null>(null)
  const [provider, setProvider] = useState('anthropic')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings/ai')
      .then(r => r.json())
      .then((d: AiConfig) => {
        setConfig(d)
        if (d.aiProvider) setProvider(d.aiProvider)
      })
  }, [])

  async function save() {
    setSaving(true)
    setMsg(null)
    const res = await fetch('/api/settings/ai', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiProvider: provider, apiKey }),
    })
    setSaving(false)
    if (res.ok) {
      setMsg({ type: 'ok', text: '已儲存' })
      setApiKey('')
      const d: AiConfig = await fetch('/api/settings/ai').then(r => r.json())
      setConfig(d)
    } else {
      const d = await res.json()
      setMsg({ type: 'err', text: d.error ?? '儲存失敗' })
    }
  }

  async function remove() {
    if (!confirm('確定要移除 AI API Key？')) return
    await fetch('/api/settings/ai', { method: 'DELETE' })
    setConfig({ aiProvider: '', apiKeySet: false, apiKeyHint: '' })
    setProvider('anthropic')
    setMsg({ type: 'ok', text: '已移除' })
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">關於 AI 功能計費</p>
        <p>
          AI 解析功能使用您自己的 API Key，所有呼叫費用由您的帳號承擔，
          與本系統帳號無關。API Key 以 AES-256-GCM 加密儲存。
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">AI 供應商</label>
          <div className="flex gap-4">
            {[
              { value: 'anthropic', label: 'Claude (Anthropic)', hint: 'sk-ant-...' },
              { value: 'openai', label: 'ChatGPT (OpenAI)', hint: 'sk-...' },
            ].map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="provider"
                  value={opt.value}
                  checked={provider === opt.value}
                  onChange={() => setProvider(opt.value)}
                  className="accent-blue-600"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Key
            {config?.apiKeySet && (
              <span className="ml-2 text-xs text-gray-500 font-normal">
                目前：{config.apiKeyHint}
              </span>
            )}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={
              config?.apiKeySet
                ? '輸入新 Key 以覆蓋，或留空保留現有 Key'
                : provider === 'anthropic'
                ? 'sk-ant-api03-...'
                : 'sk-proj-...'
            }
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
          />
        </div>

        {msg && (
          <p className={`text-sm ${msg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
            {msg.text}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '儲存中…' : '儲存'}
          </button>
          {config?.apiKeySet && (
            <button
              onClick={remove}
              className="border border-red-300 text-red-600 px-4 py-2 rounded-md text-sm hover:bg-red-50"
            >
              移除 Key
            </button>
          )}
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="text-xs text-gray-500 mb-2 font-medium">支援的 AI 功能</p>
        <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
          <li>採購單：上傳 PDF/圖片/Excel → AI 自動解析品項、供應商、金額</li>
          <li>後續：成本試算、庫存預測（規劃中）</li>
        </ul>
      </div>
    </div>
  )
}
