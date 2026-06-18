'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Config = {
  mcpUrl: string
  username: string
  passwordSet: boolean
  apiKey: string
  userId: string
  jwtSet: boolean
  jwtExpiresAt: string | null
  jwtExpired: boolean
  webhookSecretSet: boolean
  cronSecretSet: boolean
  syncEnabled: boolean
  lastTestedAt: string | null
  lastTestStatus: string | null
  lastTestMsg: string | null
} | null

export default function PatiscoConfigForm({ initialConfig }: { initialConfig: Config }) {
  const router = useRouter()

  const [username, setUsername] = useState(initialConfig?.username ?? '')
  const [password, setPassword] = useState('')
  const [syncEnabled, setSyncEnabled] = useState(initialConfig?.syncEnabled ?? true)
  const [syncToggling, setSyncToggling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncElapsed, setSyncElapsed] = useState(0)
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; piCount?: number; error?: string } | null>(null)
  const [syncResult, setSyncResult] = useState<{
    buyers?: { created: number; updated: number; total: number; errors: number }
    pi?: { processed: number; skipped: number; errors: number }
    po?: { processed: number; skipped: number; errors: number }
    deliveries?: { processed: number; errors: number; total: number }
    durationMs?: number
  } | null>(null)

  const isConfigured = !!initialConfig
  const statusOk = initialConfig?.lastTestStatus === 'ok'
  const statusErr = initialConfig?.lastTestStatus === 'error'

  async function handleToggleSync() {
    const next = !syncEnabled
    setSyncEnabled(next)
    setSyncToggling(true)
    try {
      await fetch('/api/settings/patisco', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncEnabled: next }),
      })
      router.refresh()
    } finally {
      setSyncToggling(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (!username) { setMsg({ type: 'error', text: '請填入帳號' }); return }
    if (!password && !initialConfig?.passwordSet) {
      setMsg({ type: 'error', text: '首次設定請填入密碼' }); return
    }
    setSaving(true)
    const res = await fetch('/api/settings/patisco', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mcpUrl: 'https://mcp.patisco.com',
        username,
        ...(password ? { password } : {}),
        syncEnabled,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setMsg({ type: 'ok', text: '設定已儲存' })
      setPassword('')
      router.refresh()
    } else {
      const data = await res.json()
      setMsg({ type: 'error', text: data.error ?? '儲存失敗' })
    }
  }

  async function handleTest() {
    setTesting(true); setTestResult(null)
    const res = await fetch('/api/settings/patisco/test', { method: 'POST' })
    const data = await res.json()
    setTesting(false)
    setTestResult(data)
    router.refresh()
  }

  const callSync = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/patisco/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error ?? '同步失敗')
    return data
  }

  async function handleManualSync() {
    setSyncing(true); setSyncResult(null); setMsg(null); setSyncElapsed(0)
    const startTime = Date.now()
    const timer = setInterval(() => setSyncElapsed(Math.floor((Date.now() - startTime) / 1000)), 500)
    try {
      const data = await callSync({ type: 'all' })
      clearInterval(timer)
      setSyncing(false)
      setSyncResult({ ...data, durationMs: Date.now() - startTime })
      router.refresh()
    } catch (err) {
      clearInterval(timer)
      setSyncing(false)
      setMsg({ type: 'error', text: `同步失敗：${err instanceof Error ? err.message : '未知錯誤'}` })
    }
  }

  return (
    <div className="bg-white rounded-lg shadow divide-y divide-gray-100">

      {/* ── 狀態列 ── */}
      <div className={`px-6 py-3 flex items-center justify-between rounded-t-lg ${
        statusOk ? 'bg-green-50' : statusErr ? 'bg-red-50' : 'bg-gray-50'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusOk ? 'bg-green-500' : statusErr ? 'bg-red-500' : 'bg-gray-400'}`} />
          <span className="text-sm font-medium text-gray-700">
            {statusOk ? '已連線' : statusErr ? '連線失敗' : isConfigured ? '未測試' : '尚未設定'}
          </span>
          {initialConfig?.lastTestMsg && statusErr && (
            <span className="text-xs text-red-500">— {initialConfig.lastTestMsg}</span>
          )}
        </div>
        {isConfigured && (
          <div className="flex gap-2">
            <button onClick={handleTest} disabled={testing}
              className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50">
              {testing ? '測試中...' : '測試連線'}
            </button>
            <button onClick={handleManualSync} disabled={syncing}
              className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
              {syncing ? (
                <><Spinner />同步中 {syncElapsed > 0 ? `${syncElapsed}s` : ''}</>
              ) : '手動同步'}
            </button>
          </div>
        )}
      </div>

      {/* ── 測試 / 同步結果 ── */}
      {testResult && (
        <div className={`px-6 py-3 text-sm ${testResult.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
          {testResult.ok
            ? `✓ 連線正常，PI 查詢回傳 ${testResult.piCount} 筆`
            : `✗ ${testResult.error}`}
        </div>
      )}

      {syncing && (
        <div className="px-6 py-2.5 bg-blue-600 text-white text-sm flex items-center gap-2">
          <Spinner white />
          正在同步 Patisco 資料，已等待 {syncElapsed}s…
        </div>
      )}

      {syncResult && (
        <div className="px-6 py-3 bg-blue-50 text-sm text-blue-800">
          <p className="font-medium mb-2">
            ✓ 同步完成{syncResult.durationMs ? `（${(syncResult.durationMs / 1000).toFixed(1)}s）` : ''}
          </p>
          <div className="grid grid-cols-3 gap-3 text-xs">
            {syncResult.buyers && (
              <SyncCard label="客戶" icon="👥"
                rows={[`新增 ${syncResult.buyers.created}`, `更新 ${syncResult.buyers.updated}`, `共 ${syncResult.buyers.total} 筆`]}
                err={syncResult.buyers.errors} />
            )}
            {syncResult.pi && (
              <SyncCard label="PI 同步" icon="📄"
                rows={[`處理 ${syncResult.pi.processed}`, `跳過 ${syncResult.pi.skipped}`]}
                err={syncResult.pi.errors} />
            )}
            {syncResult.po && (
              <SyncCard label="採購 PO" icon="📦"
                rows={[`處理 ${syncResult.po.processed}`, `跳過 ${syncResult.po.skipped}`]}
                err={syncResult.po.errors} />
            )}
          </div>
        </div>
      )}

      {/* ── 表單 ── */}
      <form onSubmit={handleSave} className="p-6 space-y-5">

        {/* 同步開關 */}
        <div className={`flex items-center justify-between px-4 py-3 rounded-lg border-2 ${
          syncEnabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
        }`}>
          <div>
            <p className={`text-sm font-semibold ${syncEnabled ? 'text-green-800' : 'text-gray-600'}`}>
              {syncEnabled ? '✓ Patisco 資料同步：開啟中' : '⏸ Patisco 資料同步：已暫停'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {syncEnabled ? '系統會定期從 Patisco MCP Server 拉取訂單、PI、採購副本資料。' : 'Webhook 接收不受影響。'}
            </p>
          </div>
          <button type="button" onClick={handleToggleSync} disabled={syncToggling}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${syncEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${syncEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* 帳號密碼 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Email / Login ID <span className="text-red-500">*</span></label>
            <input type="email" value={username} onChange={e => setUsername(e.target.value)}
              className={inp} placeholder="even@pointasia.com.tw" autoComplete="username" />
          </div>
          <div>
            <label className={lbl}>
              密碼
              {initialConfig?.passwordSet
                ? <span className="text-green-600 font-normal ml-1 text-xs">✓ 已設定（留空不變更）</span>
                : <span className="text-red-500"> *</span>}
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className={inp} placeholder={initialConfig?.passwordSet ? '••••（留空不變更）' : '請輸入密碼'}
              autoComplete="current-password" />
          </div>
        </div>

        {msg && (
          <div className={`text-sm px-3 py-2 rounded ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {msg.type === 'ok' ? '✓' : '✗'} {msg.text}
          </div>
        )}

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? '儲存中...' : '儲存設定'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Spinner({ white }: { white?: boolean }) {
  return (
    <svg className={`animate-spin h-3.5 w-3.5 ${white ? 'text-white' : 'text-current'}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function SyncCard({ label, icon, rows, err }: { label: string; icon: string; rows: string[]; err: number }) {
  return (
    <div className="bg-white rounded px-3 py-2 border border-blue-100">
      <p className="font-medium text-blue-700 mb-1">{icon} {label}</p>
      {rows.map((r, i) => <p key={i}>{r}</p>)}
      {err > 0 && <p className="text-red-500">錯誤 {err}</p>}
    </div>
  )
}

const lbl = 'block text-sm font-medium text-gray-700 mb-1'
const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
