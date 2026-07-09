'use client'

import { useState, useEffect } from 'react'

interface UpsConfig {
  upsMode: 'disabled' | 'managed' | 'own'
  ownAccountNo: string
  ownDiscountMultiplier: number | null
}

export default function UpsForm() {
  const [config, setConfig] = useState<UpsConfig | null>(null)
  const [ownAccountNo, setOwnAccountNo] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings/ups').then(r => r.json()).then((d: UpsConfig) => {
      setConfig(d)
      setOwnAccountNo(d.ownAccountNo ?? '')
    })
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/settings/ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownAccountNo }),
      })
      if (res.ok) {
        setMsg({ type: 'ok', text: '已儲存' })
        const updated: UpsConfig = await fetch('/api/settings/ups').then(r => r.json())
        setConfig(updated)
      } else {
        const d = await res.json() as { error?: string }
        setMsg({ type: 'err', text: d.error ?? '儲存失敗' })
      }
    } catch (err) {
      setMsg({ type: 'err', text: `網路錯誤：${err instanceof Error ? err.message : String(err)}` })
    } finally {
      setSaving(false)
    }
  }

  if (!config) return <div className="text-sm text-gray-400">載入中…</div>

  const platformEnabled = config.upsMode === 'managed'
  const hasOwnAccount = !!config.ownAccountNo.trim()
  const activeSource = hasOwnAccount ? 'own' : platformEnabled ? 'managed' : 'none'

  return (
    <div className="space-y-8">

      {/* ── 目前狀態 ─── */}
      <div className={`rounded-lg border px-4 py-3 text-sm ${
        activeSource === 'none'
          ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
          : 'bg-green-50 border-green-200 text-green-800'
      }`}>
        {activeSource === 'own' && <span>✓ 目前使用自有 UPS 帳號（{config.ownAccountNo.slice(0,2)}****）</span>}
        {activeSource === 'managed' && <span>✓ 目前使用平台代管 UPS 服務（錫諾系統帳號）</span>}
        {activeSource === 'none' && <span>⚠ UPS 服務尚未開通。若需使用出貨功能，請聯繫錫諾系統開通，或填寫自有帳號。</span>}
      </div>

      {/* ── 平台代管 ─── */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">平台代管 UPS（由錫諾系統提供）</h2>
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          platformEnabled
            ? 'border-blue-200 bg-blue-50 text-blue-800'
            : 'border-gray-200 bg-gray-50 text-gray-500'
        }`}>
          {platformEnabled
            ? '✓ 錫諾系統已為您開通平台代管 UPS，享有錫諾合約折扣費率。'
            : '目前尚未開通。請聯繫錫諾系統，由後台為您開通。'}
        </div>
        <p className="text-xs text-gray-400">平台代管帳號由錫諾系統管理，優先順序低於自有帳號。</p>
      </section>

      {/* ── 自有帳號 ─── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">自有 UPS 帳號（選填）</h2>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">UPS Account Number</label>
            <input
              type="text"
              value={ownAccountNo}
              onChange={e => setOwnAccountNo(e.target.value)}
              placeholder="6 位英數字，例：872Y1F"
              className="w-64 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">填入後將優先使用自有帳號，清空則恢復使用平台代管（若已開通）。</p>
          </div>

          {msg && (
            <p className={`text-sm ${msg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
              {msg.type === 'ok' ? '✓ ' : '✗ '}{msg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '儲存中…' : '儲存自有帳號設定'}
          </button>
        </form>
      </section>
    </div>
  )
}
