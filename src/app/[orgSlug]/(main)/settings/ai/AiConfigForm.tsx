'use client'
import { useState, useEffect } from 'react'

interface AiConfig {
  aiProvider: string
  apiKeySet: boolean
  apiKeyHint: string
  aiParseModel: string
}

const PROVIDERS = {
  anthropic: {
    label: 'Claude (Anthropic)',
    badge: '推薦',
    keyPlaceholder: 'sk-ant-api03-...',
    buyUrl: 'https://console.anthropic.com/settings/keys',
    buyLabel: '前往 Anthropic Console 購買',
    models: [
      { value: 'claude-opus-4-8', label: 'Claude Opus 4（最強，解析複雜文件）' },
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4（平衡速度與準確）' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4（最快最省，簡單文件）' },
    ],
    defaultModel: 'claude-opus-4-8',
    costNote: '供應商訂單解析每次約 USD $0.01–0.05',
  },
  openai: {
    label: 'ChatGPT (OpenAI)',
    badge: '',
    keyPlaceholder: 'sk-proj-...',
    buyUrl: 'https://platform.openai.com/api-keys',
    buyLabel: '前往 OpenAI Platform 購買',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o（最強，解析複雜文件）' },
      { value: 'gpt-4o-mini', label: 'GPT-4o mini（省錢，適合簡單文件）' },
    ],
    defaultModel: 'gpt-4o',
    costNote: '供應商訂單解析每次約 USD $0.01–0.03',
  },
} as const

type Provider = keyof typeof PROVIDERS

export default function AiConfigForm() {
  const [config, setConfig] = useState<AiConfig | null>(null)
  const [provider, setProvider] = useState<Provider>('anthropic')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [parseModel, setParseModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const meta = PROVIDERS[provider]

  useEffect(() => {
    fetch('/api/settings/ai').then(r => r.json()).then((d: AiConfig) => {
      setConfig(d)
      if (d.aiProvider && d.aiProvider in PROVIDERS) setProvider(d.aiProvider as Provider)
      if (d.aiParseModel) setParseModel(d.aiParseModel)
    })
  }, [])

  async function save() {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiProvider: provider, apiKey, aiParseModel: parseModel || null }),
      })
      const d = await res.json() as { error?: string }
      if (res.ok) {
        setMsg({ type: 'ok', text: '已儲存' })
        setApiKey('')
        const updated: AiConfig = await fetch('/api/settings/ai').then(r => r.json())
        setConfig(updated)
      } else {
        setMsg({ type: 'err', text: `錯誤 ${res.status}：${d.error ?? '儲存失敗'}` })
      }
    } catch (err) {
      setMsg({ type: 'err', text: `網路錯誤：${err instanceof Error ? err.message : String(err)}` })
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm('確定移除 AI API Key？')) return
    await fetch('/api/settings/ai', { method: 'DELETE' })
    setConfig({ aiProvider: '', apiKeySet: false, apiKeyHint: '', aiParseModel: '' })
    setParseModel('')
    setMsg({ type: 'ok', text: '已移除' })
  }

  async function test() {
    setTesting(true); setTestMsg(null)
    const res = await fetch('/api/settings/ai/test', { method: 'POST' })
    setTesting(false)
    if (res.ok) {
      setTestMsg({ type: 'ok', text: '✓ 連線成功，AI 功能正常運作' })
    } else {
      const d = await res.json() as { error?: string }
      setTestMsg({ type: 'err', text: d.error ?? '連線失敗' })
    }
  }

  return (
    <div className="max-w-2xl space-y-8">

      {/* ── 功能說明 ─────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
        <h2 className="font-semibold text-blue-900 mb-3">AI 能幫你做什麼？</h2>
        <div className="space-y-3">
          <Feature
            icon="📄"
            title="供應商訂單自動解析"
            desc="上傳供應商寄來的 PDF、圖片或 Excel，AI 自動讀取品名、料號、數量、單價、供應商名稱，一鍵填入採購表單，省去手動輸入。"
            tag="現已上線"
            tagColor="green"
          />
          <Feature
            icon="🏭"
            title="自動建立供應商與商品"
            desc="解析結果中的供應商和品項，系統會自動比對現有資料，找不到的直接新建，不需要手動維護。"
            tag="現已上線"
            tagColor="green"
          />
          <Feature
            icon="🔢"
            title="HTS Code 自動分類"
            desc="輸入商品描述，AI 建議最符合的 HS Code 及關稅稅率，用於成本計算。"
            tag="規劃中"
            tagColor="gray"
          />
          <Feature
            icon="📊"
            title="庫存預測與補貨建議"
            desc="根據歷史銷售與採購紀錄，預測何時需要補貨，以及建議採購數量。"
            tag="規劃中"
            tagColor="gray"
          />
        </div>
      </section>

      {/* ── 已設定狀態 ───────────────────────────────────────── */}
      {config?.apiKeySet && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-green-800">
            <span className="text-green-500 text-base">✓</span>
            <span>已設定 <strong>{PROVIDERS[config.aiProvider as Provider]?.label ?? config.aiProvider}</strong></span>
            <span className="text-green-600 font-mono text-xs">{config.apiKeyHint}</span>
            {config.aiParseModel && (
              <span className="text-green-600 text-xs">· {config.aiParseModel}</span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={test} disabled={testing}
              className="text-xs border border-green-300 text-green-700 px-3 py-1 rounded hover:bg-green-100 disabled:opacity-50">
              {testing ? '測試中…' : '測試連線'}
            </button>
            <button onClick={remove}
              className="text-xs border border-red-200 text-red-500 px-3 py-1 rounded hover:bg-red-50">
              移除
            </button>
          </div>
        </div>
      )}
      {testMsg && (
        <p className={`text-sm ${testMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{testMsg.text}</p>
      )}

      {/* ── 服務商選擇 ───────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
          {config?.apiKeySet ? '更換服務商 / API Key' : '選擇 AI 服務商'}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(PROVIDERS) as Provider[]).map(p => (
            <button key={p} type="button" onClick={() => setProvider(p)}
              className={`text-left rounded-xl border p-4 transition-all ${
                provider === p
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}>
              <div className="flex items-start justify-between mb-1">
                <span className="font-medium text-sm text-gray-800">{PROVIDERS[p].label}</span>
                {PROVIDERS[p].badge && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                    {PROVIDERS[p].badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 font-mono">{PROVIDERS[p].keyPlaceholder}</p>
              <p className="text-xs text-gray-400 mt-1">{PROVIDERS[p].costNote}</p>
            </button>
          ))}
        </div>

        {/* 購買連結 */}
        <a href={meta.buyUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
          <span>🔗</span>
          <span>{meta.buyLabel}</span>
          <span className="text-xs text-blue-400">（外部連結，新分頁開啟）</span>
        </a>

        {/* API Key 輸入 + 快速儲存 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Key
            {config?.apiKeySet && (
              <span className="ml-2 text-xs text-gray-400 font-normal">目前：{config.apiKeyHint}</span>
            )}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={config?.apiKeySet ? '輸入新 Key 以覆蓋，或留空保留現有 Key' : meta.keyPlaceholder}
                className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-xs">
                {showKey ? '隱藏' : '顯示'}
              </button>
            </div>
            <button onClick={save} disabled={saving}
              className="shrink-0 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? '儲存中…' : '儲存'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">API Key 以 AES-256-GCM 加密儲存，員工無法看到明文。</p>
        </div>

        {/* 模型選擇 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            文件解析模型
            <span className="ml-1 text-xs text-gray-400 font-normal">
              （預設：{meta.defaultModel}）
            </span>
          </label>
          <select value={parseModel} onChange={e => setParseModel(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">使用預設（{meta.defaultModel}）</option>
            {meta.models.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">較強的模型解析複雜 PDF 準確率更高，但費用也較高。</p>
        </div>

        {msg && (
          <div className={`rounded-md px-4 py-3 text-sm font-medium ${
            msg.type === 'ok'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {msg.type === 'ok' ? '✓ ' : '✗ '}{msg.text}
          </div>
        )}
      </section>

      {/* ── 計費說明 ─────────────────────────────────────────── */}
      <section className="border-t pt-5 text-xs text-gray-400 space-y-1">
        <p className="font-medium text-gray-500">關於計費（BYOK — Bring Your Own Key）</p>
        <p>• 所有 AI 功能直接使用您的服務帳號，費用由您的帳單計費，PAXIS 不收取任何 AI 費用。</p>
        <p>• Anthropic 免費試用額度：新帳號約 USD $5，足夠測試數百張供應商訂單。</p>
        <p>• OpenAI 免費試用額度：新帳號約 USD $5（到期後需付費）。</p>
        <p>• 建議選用較強的解析模型（Opus / GPT-4o）以確保複雜 PDF 的解析準確率。</p>
      </section>
    </div>
  )
}

function Feature({ icon, title, desc, tag, tagColor }: {
  icon: string; title: string; desc: string; tag: string; tagColor: 'green' | 'gray'
}) {
  return (
    <div className="flex gap-3">
      <span className="text-xl leading-none mt-0.5">{icon}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-gray-800">{title}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            tagColor === 'green'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {tag}
          </span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}
