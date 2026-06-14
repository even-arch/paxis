'use client'

import { useState } from 'react'

type Source = 'db' | 'env' | 'none'

interface Props {
  initialAccountNo: string | null
  source: Source
  initialMultiplier: number | null
}

export default function UpsForm({ initialAccountNo, source, initialMultiplier }: Props) {
  const [accountNo, setAccountNo] = useState(initialAccountNo ?? '')
  const [multiplier, setMultiplier] = useState(
    initialMultiplier != null ? String(initialMultiplier) : ''
  )
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)

    // 驗證折扣係數
    const multiplierVal = multiplier.trim()
    if (multiplierVal !== '') {
      const n = parseFloat(multiplierVal)
      if (isNaN(n) || n <= 0 || n > 1) {
        setMsg({ type: 'err', text: '折扣係數必須介於 0（不含）至 1 之間，例如 0.35' })
        setSaving(false)
        return
      }
    }

    try {
      const res = await fetch('/api/admin/settings/ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountNo,
          discountMultiplier: multiplierVal === '' ? null : parseFloat(multiplierVal),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '儲存失敗')
      setMsg({ type: 'ok', text: '已儲存' })
    } catch (err: unknown) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : '儲存失敗' })
    } finally {
      setSaving(false)
    }
  }

  const sourceLabel: Record<Source, string> = {
    db: '✅ 目前使用 DB 設定',
    env: '⚠️ 目前使用環境變數（XINOSYS_UPS_ACCOUNT_NO）',
    none: '❌ 尚未設定',
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">

      {/* Account Number */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700">帳號設定</h3>
        <div className="text-xs px-3 py-2 rounded-md bg-gray-50 border text-gray-500">
          {sourceLabel[source]}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-gray-600">錫諾系統 UPS Account Number</label>
          <input
            type="text"
            value={accountNo}
            onChange={e => setAccountNo(e.target.value)}
            placeholder="例：872Y1F"
            className="w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400">
            留空可清除 DB 值，系統將 fallback 至環境變數 XINOSYS_UPS_ACCOUNT_NO。
          </p>
        </div>
      </div>

      {/* Discount Multiplier */}
      <div className="space-y-3 border-t pt-5">
        <div>
          <h3 className="text-sm font-medium text-gray-700">契約折扣係數</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            實際帳單金額 ÷ UPS API 報價。例如帳單 NT$11,316 ÷ API 報價 NT$31,329 ≈ <strong>0.361</strong>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            套用後，查詢結果顯示的「契約估算金額」= API 報價 × 此係數。留空則不套用。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={multiplier}
            onChange={e => setMultiplier(e.target.value)}
            min={0.01}
            max={1}
            step={0.001}
            placeholder="例：0.361"
            className="w-36 border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {multiplier && (
            <span className="text-xs text-gray-500">
              = API 報價打 {(parseFloat(multiplier) * 10).toFixed(2)} 折
            </span>
          )}
        </div>
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
