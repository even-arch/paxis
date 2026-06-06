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

type Mode = 'token' | 'password'

export default function PatiscoConfigForm({ initialConfig }: { initialConfig: Config }) {
  const router = useRouter()
  // 預設：有 apiKey 就用 token 模式，否則 password 模式
  const [mode, setMode] = useState<Mode>(
    initialConfig?.apiKey ? 'token' : 'password'
  )
  const [mcpUrl, setMcpUrl] = useState(initialConfig?.mcpUrl ?? 'https://mcp.patisco.com')

  // Token 模式
  const [jwt, setJwt] = useState('')
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? '')

  // 帳密模式
  const [username, setUsername] = useState(initialConfig?.username ?? '')
  const [password, setPassword] = useState('')

  // Sync 開關
  const [syncEnabled, setSyncEnabled] = useState(initialConfig?.syncEnabled ?? true)
  const [syncToggling, setSyncToggling] = useState(false)

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

  // 安全設定
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [webhookSecret, setWebhookSecret] = useState('')
  const [cronSecret, setCronSecret] = useState('')

  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [catalogSyncing, setCatalogSyncing] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [testResult, setTestResult] = useState<{
    ok: boolean; tools?: string[]; msg?: string; error?: string
  } | null>(null)
  const [syncResult, setSyncResult] = useState<{
    buyers?: { created: number; updated: number; errors: number; total: number }
    pi?: { processed: number; skipped: number; errors: number; details?: Array<{patiscoDocNo:string; status:string; msg?:string}> }
    shipments?: { processed: number; skipped: number; errors: number }
    durationMs?: number
  } | null>(null)
  const [catalogResult, setCatalogResult] = useState<{
    products: number; created: number; updated: number; skipped: number; errors: number; durationMs?: number
  } | null>(null)

  const isConfigured = !!initialConfig
  const jwtExpired = initialConfig?.jwtExpired

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)

    const body: Record<string, unknown> = {
      mcpUrl,
      webhookSecret,
      cronSecret,
      syncEnabled,
    }

    if (mode === 'token') {
      if (!apiKey && !initialConfig?.apiKey) {
        setMsg({ type: 'error', text: '請填入 API Key' }); return
      }
      if (!jwt && !initialConfig?.jwtSet) {
        setMsg({ type: 'error', text: '首次設定請貼上 JWT Token' }); return
      }
      if (jwt) body.jwt = jwt
      body.apiKey = apiKey
    } else {
      if (!username) { setMsg({ type: 'error', text: '請填入帳號' }); return }
      if (!password && !initialConfig?.passwordSet) {
        setMsg({ type: 'error', text: '首次設定請填入密碼' }); return
      }
      body.username = username
      if (password) body.password = password
    }

    setSaving(true)
    const res = await fetch('/api/settings/patisco', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)

    if (res.ok) {
      setMsg({ type: 'ok', text: '設定已儲存' })
      setJwt('')
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

  async function handleCatalogSync() {
    setCatalogSyncing(true); setCatalogResult(null); setMsg(null)
    try {
      const res = await fetch('/api/patisco/catalog-sync', { method: 'POST' })
      const data = await res.json()
      setCatalogSyncing(false)
      if (data.ok) {
        setCatalogResult({
          products: data.products,
          created: data.created,
          updated: data.updated,
          skipped: data.skipped,
          errors: data.errors,
          durationMs: data.durationMs,
        })
      } else {
        setMsg({ type: 'error', text: `型錄同步失敗：${data.error ?? '未知錯誤'}` })
      }
    } catch {
      setCatalogSyncing(false)
      setMsg({ type: 'error', text: '型錄同步請求失敗，請檢查網路' })
    }
  }

  async function handleManualSync() {
    setSyncing(true); setSyncResult(null); setMsg(null)
    try {
      const res = await fetch('/api/patisco/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'all' }),
      })
      const data = await res.json()
      setSyncing(false)
      if (data.ok) {
        setSyncResult({
          buyers: data.buyers,
          pi: data.pi,      // includes details[]
          shipments: data.shipments,
          durationMs: data.durationMs,
        })
      } else {
        setMsg({ type: 'error', text: `同步失敗：${data.error ?? '未知錯誤'}` })
      }
      router.refresh()
    } catch {
      setSyncing(false)
      setMsg({ type: 'error', text: '同步請求失敗，請檢查網路' })
    }
  }

  // 連線狀態顏色
  const statusColor = initialConfig?.lastTestStatus === 'ok' ? 'bg-green-500'
    : (initialConfig?.lastTestStatus === 'error' || jwtExpired) ? 'bg-red-500'
    : 'bg-gray-400'
  const statusText = jwtExpired ? 'JWT 已過期，請更新'
    : initialConfig?.lastTestStatus === 'ok' ? '已連線'
    : initialConfig?.lastTestStatus === 'error' ? '連線失敗'
    : isConfigured ? '未測試'
    : '尚未設定'

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 狀態列 */}
      <div className={`px-6 py-3 flex items-center justify-between border-b rounded-t-lg ${
        initialConfig?.lastTestStatus === 'ok' && !jwtExpired ? 'bg-green-50 border-green-100'
          : (initialConfig?.lastTestStatus === 'error' || jwtExpired) ? 'bg-red-50 border-red-100'
          : 'bg-gray-50 border-gray-100'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-sm font-medium text-gray-700">{statusText}</span>
          {initialConfig?.userId && (
            <span className="text-xs text-gray-400">— userId: {initialConfig.userId}</span>
          )}
          {initialConfig?.lastTestMsg && !jwtExpired && (
            <span className="text-xs text-gray-500">— {initialConfig.lastTestMsg}</span>
          )}
        </div>
        {isConfigured && (
          <div className="flex gap-2">
            <button onClick={handleTest} disabled={testing}
              className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50">
              {testing ? '測試中...' : '測試連線'}
            </button>
            <button onClick={handleManualSync} disabled={syncing}
              className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {syncing ? '同步中...' : '手動同步'}
            </button>
            <button onClick={handleCatalogSync} disabled={catalogSyncing}
              className="text-sm px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
              {catalogSyncing ? '型錄同步中...' : '📦 型錄同步'}
            </button>
          </div>
        )}
      </div>

      {/* JWT 到期警示 */}
      {jwtExpired && (
        <div className="px-6 py-2 bg-orange-50 border-b border-orange-200 text-sm text-orange-700">
          ⚠ JWT Token 已過期（{initialConfig?.jwtExpiresAt?.slice(0, 10)}）。請切換到「Token 模式」重新貼上，或在「帳密模式」下儲存帳密讓系統自動重新登入。
        </div>
      )}

      {/* 測試結果 */}
      {testResult && (
        <div className={`px-6 py-3 border-b text-sm ${testResult.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
          {testResult.ok ? (
            <div>
              <p className="font-medium">✓ {testResult.msg}</p>
              {testResult.tools && testResult.tools.length > 0 && (
                <p className="text-xs mt-1 text-green-600 font-mono">
                  {testResult.tools.join('  ·  ')}
                </p>
              )}
            </div>
          ) : <p>✗ {testResult.error}</p>}
        </div>
      )}

      {/* 同步結果 */}
      {syncResult && (
        <div className="px-6 py-3 border-b bg-blue-50 text-sm text-blue-800">
          <p className="font-medium mb-1">✓ 同步完成{syncResult.durationMs ? `（${(syncResult.durationMs / 1000).toFixed(1)}s）` : ''}</p>
          <div className="grid grid-cols-3 gap-3 text-xs mt-2">
            {syncResult.buyers && (
              <div className="bg-white rounded px-3 py-2 border border-blue-100">
                <p className="font-medium text-blue-700 mb-1">👥 客戶</p>
                <p>新增 <span className="font-bold">{syncResult.buyers.created}</span></p>
                <p>更新 <span className="font-bold">{syncResult.buyers.updated}</span></p>
                <p className="text-gray-400">共 {syncResult.buyers.total} 筆</p>
                {syncResult.buyers.errors > 0 && <p className="text-red-500">錯誤 {syncResult.buyers.errors}</p>}
              </div>
            )}
            {syncResult.pi && (
              <div className="bg-white rounded px-3 py-2 border border-blue-100">
                <p className="font-medium text-blue-700 mb-1">📄 PI 同步</p>
                <p>處理 <span className="font-bold">{syncResult.pi.processed}</span></p>
                <p>跳過 <span className="font-bold">{syncResult.pi.skipped}</span></p>
                {syncResult.pi.errors > 0 && (
                  <div>
                    <p className="text-red-500">錯誤 {syncResult.pi.errors}</p>
                    {syncResult.pi.details?.filter(d=>d.status==='error').slice(0,3).map((d,i)=>(
                      <p key={i} className="text-red-400 text-xs mt-0.5 truncate">{d.patiscoDocNo}: {d.msg}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
            {syncResult.shipments && (
              <div className="bg-white rounded px-3 py-2 border border-blue-100">
                <p className="font-medium text-blue-700 mb-1">🚢 出貨同步</p>
                <p>處理 <span className="font-bold">{syncResult.shipments.processed}</span></p>
                <p>跳過 <span className="font-bold">{syncResult.shipments.skipped}</span></p>
                {syncResult.shipments.errors > 0 && <p className="text-red-500">錯誤 {syncResult.shipments.errors}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 型錄同步結果 */}
      {catalogResult && (
        <div className="px-6 py-3 border-b bg-indigo-50 text-sm text-indigo-800">
          <p className="font-medium mb-1">✓ 型錄同步完成{catalogResult.durationMs ? `（${(catalogResult.durationMs / 1000).toFixed(1)}s）` : ''}</p>
          <div className="flex gap-4 text-xs mt-2">
            <span>掃描 <b>{catalogResult.products}</b> 筆</span>
            <span className="text-green-700">新增 <b>{catalogResult.created}</b></span>
            <span className="text-blue-700">更新 <b>{catalogResult.updated}</b></span>
            {catalogResult.skipped > 0 && <span className="text-gray-500">跳過 <b>{catalogResult.skipped}</b></span>}
            {catalogResult.errors > 0 && <span className="text-red-600">錯誤 <b>{catalogResult.errors}</b></span>}
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="p-6 space-y-5">

        {/* Sync 開關 */}
        <div className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${
          syncEnabled ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
        }`}>
          <div>
            <p className={`text-sm font-semibold ${syncEnabled ? 'text-green-800' : 'text-red-800'}`}>
              {syncEnabled ? '✓ Patisco 資料同步：開啟中' : '⏸ Patisco 資料同步：已暫停'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {syncEnabled
                ? '系統會定期從 Patisco MCP Server 拉取訂單、PI、採購副本資料。'
                : '已停止從 Patisco MCP Server 撈資料。Webhook 接收不受影響。'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleSync}
            disabled={syncToggling}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 ${
              syncEnabled ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              syncEnabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* MCP URL */}
        <div>
          <label className={lbl}>MCP Gateway URL</label>
          <input type="url" value={mcpUrl} onChange={e => setMcpUrl(e.target.value)} className={inp}
            placeholder="https://mcp.patisco.com" />
        </div>

        {/* 模式切換 */}
        <div>
          <label className={lbl}>登入方式</label>
          <div className="flex gap-0 border border-gray-300 rounded-md overflow-hidden w-fit">
            <button type="button" onClick={() => setMode('token')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${mode === 'token' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              🔑 直接貼 JWT + API Key
            </button>
            <button type="button" onClick={() => setMode('password')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-l ${mode === 'password' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              👤 帳號 + 密碼（自動刷新）
            </button>
          </div>
        </div>

        {/* Token 模式 */}
        {mode === 'token' && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-md border border-blue-100">
            <p className="text-xs text-blue-600">
              使用 Patisco MCP 憑證取得工具登入後，把 JWT Token 和 API Key 貼到這裡。
              JWT 有時效性，過期後需要重新取得。
            </p>
            <div>
              <label className={lbl}>
                JWT Token
                {initialConfig?.jwtSet && !jwtExpired && (
                  <span className="text-green-600 font-normal ml-1 text-xs">✓ 已設定（未過期）</span>
                )}
                {jwtExpired && <span className="text-red-500 font-normal ml-1 text-xs">⚠ 已過期</span>}
              </label>
              <textarea value={jwt} onChange={e => setJwt(e.target.value)}
                className={`${inp} h-28 font-mono text-xs`}
                placeholder={initialConfig?.jwtSet ? '留空保留目前的 JWT（如果未過期）\n貼上新 JWT 可更新...' : '貼上 JWT Token（eyJhbGci...）'} />
            </div>
            <div>
              <label className={lbl}>
                API Key
                {initialConfig?.apiKey && <span className="text-green-600 font-normal ml-1 text-xs">✓ 已設定</span>}
              </label>
              <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)}
                className={`${inp} font-mono`}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              <p className="text-xs text-gray-400 mt-1">API Key 是長效的，通常不需要更換</p>
            </div>
          </div>
        )}

        {/* 帳密模式 */}
        {mode === 'password' && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-md border border-gray-200">
            <p className="text-xs text-gray-500">
              系統每次同步時自動用帳密登入取得新 JWT，適合長期穩定運行。
              帳號格式為 Email（例如：even@pointasia.com.tw）
            </p>
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
          </div>
        )}

        {/* 進階設定 */}
        <div>
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:underline">
            {showAdvanced ? '▲ 收起' : '▼ 進階設定（Webhook / Cron 安全驗證）'}
          </button>
          {showAdvanced && (
            <div className="mt-3 grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-md">
              <div>
                <label className={lbl}>Webhook Secret
                  {initialConfig?.webhookSecretSet && <span className="text-green-600 ml-1 text-xs">✓ 已設定</span>}
                </label>
                <input type="password" value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)}
                  className={inp} placeholder={initialConfig?.webhookSecretSet ? '留空保留舊值' : '選用'} />
              </div>
              <div>
                <label className={lbl}>Cron Secret
                  {initialConfig?.cronSecretSet && <span className="text-green-600 ml-1 text-xs">✓ 已設定</span>}
                </label>
                <input type="password" value={cronSecret} onChange={e => setCronSecret(e.target.value)}
                  className={inp} placeholder={initialConfig?.cronSecretSet ? '留空保留舊值' : '選用'} />
              </div>
            </div>
          )}
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
