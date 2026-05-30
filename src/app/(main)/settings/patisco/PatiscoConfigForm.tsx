'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Config = {
  mcpUrl: string
  username: string
  passwordSet: boolean
  webhookSecretSet: boolean
  cronSecretSet: boolean
  lastTestedAt: string | null
  lastTestStatus: string | null
  lastTestMsg: string | null
} | null

export default function PatiscoConfigForm({ initialConfig }: { initialConfig: Config }) {
  const router = useRouter()
  const [mcpUrl, setMcpUrl] = useState(initialConfig?.mcpUrl ?? 'https://mcp.patisco.com:9443')
  const [username, setUsername] = useState(initialConfig?.username ?? '')
  const [password, setPassword] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [cronSecret, setCronSecret] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [testResult, setTestResult] = useState<{
    ok: boolean; tools?: string[]; msg?: string; error?: string
  } | null>(null)

  const isConfigured = !!initialConfig?.username

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!username) { setMsg({ type: 'error', text: '請填寫帳號' }); return }
    if (!isConfigured && !password) { setMsg({ type: 'error', text: '首次設定必須填入密碼' }); return }

    setSaving(true); setMsg(null)
    const res = await fetch('/api/settings/patisco', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mcpUrl, username, password: password || undefined, webhookSecret, cronSecret }),
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

  async function handleManualSync() {
    setSyncing(true)
    const res = await fetch('/api/webhooks/patisco', { method: 'POST' })
    const data = await res.json()
    setSyncing(false)
    setMsg({
      type: data.ok ? 'ok' : 'error',
      text: data.ok
        ? `同步完成：處理 ${data.processed ?? 0} 張，跳過 ${data.skipped ?? 0} 張`
        : `同步失敗：${data.error ?? '未知錯誤'}`,
    })
    router.refresh()
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 連線狀態列 */}
      <div className={`px-6 py-3 flex items-center justify-between border-b ${
        initialConfig?.lastTestStatus === 'ok'
          ? 'bg-green-50 border-green-100'
          : initialConfig?.lastTestStatus === 'error'
          ? 'bg-red-50 border-red-100'
          : 'bg-gray-50 border-gray-100'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            initialConfig?.lastTestStatus === 'ok' ? 'bg-green-500' :
            initialConfig?.lastTestStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
          }`} />
          <span className="text-sm font-medium text-gray-700">
            {initialConfig?.lastTestStatus === 'ok' ? '已連線'
              : initialConfig?.lastTestStatus === 'error' ? '連線失敗'
              : isConfigured ? '未測試'
              : '尚未設定'}
          </span>
          {initialConfig?.lastTestMsg && (
            <span className="text-xs text-gray-500">— {initialConfig.lastTestMsg}</span>
          )}
        </div>
        {isConfigured && (
          <div className="flex gap-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50"
            >
              {testing ? '測試中...' : '測試連線'}
            </button>
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {syncing ? '同步中...' : '手動同步'}
            </button>
          </div>
        )}
      </div>

      {/* 測試結果 */}
      {testResult && (
        <div className={`px-6 py-3 border-b text-sm ${testResult.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
          {testResult.ok ? (
            <div>
              <p className="font-medium">✓ {testResult.msg}</p>
              {testResult.tools && testResult.tools.length > 0 && (
                <p className="text-xs mt-1 text-green-600">可用工具：{testResult.tools.join('、')}</p>
              )}
            </div>
          ) : (
            <p>✗ {testResult.error}</p>
          )}
        </div>
      )}

      <form onSubmit={handleSave} className="p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-700">MCP 連線憑證</h2>

        <div>
          <label className={lbl}>MCP Gateway URL</label>
          <input type="url" value={mcpUrl} onChange={e => setMcpUrl(e.target.value)}
            className={inp} placeholder="https://mcp.patisco.com:9443" />
          <p className="text-xs text-gray-400 mt-1">Patisco MCP 伺服器位址，通常不需要修改</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Patisco 帳號 <span className="text-red-500">*</span></label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              className={inp} placeholder="your-login-id" autoComplete="username" />
          </div>
          <div>
            <label className={lbl}>
              密碼 {isConfigured && <span className="text-gray-400 font-normal">（留空保留舊密碼）</span>}
              {!isConfigured && <span className="text-red-500"> *</span>}
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className={inp} placeholder={isConfigured ? '••••••••（留空不變更）' : '請輸入密碼'}
              autoComplete="current-password" />
          </div>
        </div>

        {/* 進階設定 */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:underline"
          >
            {showAdvanced ? '▲ 收起進階設定' : '▼ 進階設定（Webhook / Cron 安全驗證）'}
          </button>

          {showAdvanced && (
            <div className="mt-3 grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-md">
              <div>
                <label className={lbl}>
                  Webhook Secret
                  {initialConfig?.webhookSecretSet && <span className="text-green-600 ml-1 text-xs">✓ 已設定</span>}
                </label>
                <input type="password" value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)}
                  className={inp} placeholder={initialConfig?.webhookSecretSet ? '（留空保留舊值）' : '選用'} />
                <p className="text-xs text-gray-400 mt-1">用於驗證 Patisco Webhook 推送的簽名</p>
              </div>
              <div>
                <label className={lbl}>
                  Cron Secret
                  {initialConfig?.cronSecretSet && <span className="text-green-600 ml-1 text-xs">✓ 已設定</span>}
                </label>
                <input type="password" value={cronSecret} onChange={e => setCronSecret(e.target.value)}
                  className={inp} placeholder={initialConfig?.cronSecretSet ? '（留空保留舊值）' : '選用'} />
                <p className="text-xs text-gray-400 mt-1">防止 Cron 端點被外部呼叫</p>
              </div>
            </div>
          )}
        </div>

        {msg && (
          <div className={`text-sm px-3 py-2 rounded ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {msg.type === 'ok' ? '✓' : '✗'} {msg.text}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? '儲存中...' : '儲存設定'}
          </button>
          {!isConfigured && (
            <p className="text-xs text-gray-400 self-center">儲存後點「測試連線」確認可以連上 Patisco</p>
          )}
        </div>
      </form>
    </div>
  )
}

const lbl = 'block text-sm font-medium text-gray-700 mb-1'
const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
