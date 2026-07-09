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

    // 驗證服務費乘數
    const multiplierVal = multiplier.trim()
    if (multiplierVal !== '') {
      const n = parseFloat(multiplierVal)
      if (isNaN(n) || n <= 0) {
        setMsg({ type: 'err', text: '服務費乘數必須大於 0，例如 1.2 代表加收 20%' })
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

      {/* Service Fee Multiplier */}
      <div className="space-y-3 border-t pt-5">
        <div>
          <h3 className="text-sm font-medium text-gray-700">服務費乘數</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            租戶使用平台代管 UPS 時，對<strong>基本運費</strong>套用的乘數。例如 <strong>1.2</strong> = 加收 20%。
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            燃油附加費、旺季附加費等附加費<strong>不加</strong>（屬公開收費，租戶可自行查核）。留空則以原價顯示。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={multiplier}
            onChange={e => setMultiplier(e.target.value)}
            min={0.01}
            step={0.001}
            placeholder="例：1.2"
            className="w-36 border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {multiplier && !isNaN(parseFloat(multiplier)) && parseFloat(multiplier) > 0 && (
            <span className="text-xs text-gray-500">
              {parseFloat(multiplier) >= 1
                ? `= 基本運費加收 ${((parseFloat(multiplier) - 1) * 100).toFixed(1)}%`
                : `= 基本運費打 ${(parseFloat(multiplier) * 100).toFixed(1)}% 折`}
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
