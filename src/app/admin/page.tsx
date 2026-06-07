import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getSystemSetting } from '@/lib/system-settings'
import UpsForm from './settings/ups/UpsForm'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login?callbackUrl=%2Fadmin')
  }

  const [dbAccountNo, dbMultiplier] = await Promise.all([
    getSystemSetting('ups_xinosys_account_no'),
    getSystemSetting('ups_discount_multiplier'),
  ])

  const effective = dbAccountNo?.trim() || null
  const hasEnv = !!process.env.XINOSYS_UPS_ACCOUNT_NO
  const source: 'db' | 'env' | 'none' =
    effective ? 'db' : hasEnv ? 'env' : 'none'
  const multiplier = dbMultiplier ? parseFloat(dbMultiplier) : null

  // OAuth 憑證只能存環境變數，這裡只看有沒有設
  const hasClientId     = !!process.env.UPS_CLIENT_ID
  const hasClientSecret = !!process.env.UPS_CLIENT_SECRET

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">系統設定</h1>
        <p className="text-sm text-gray-400 mt-0.5">PAXIS 管理後台（單租戶模式）</p>
      </div>

      {/* UPS OAuth 憑證狀態（唯讀，只能改 Vercel 環境變數） */}
      <div className="bg-white rounded-lg border p-6 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🔑</span>
          <h2 className="text-base font-semibold text-gray-800">UPS OAuth 憑證</h2>
          <span className="text-xs text-gray-400 ml-auto">只能在 Vercel 環境變數設定</span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-gray-600 font-mono text-xs">UPS_CLIENT_ID</span>
            {hasClientId
              ? <span className="text-green-600 font-medium">✅ 已設定</span>
              : <span className="text-red-500 font-medium">❌ 未設定</span>}
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-600 font-mono text-xs">UPS_CLIENT_SECRET</span>
            {hasClientSecret
              ? <span className="text-green-600 font-medium">✅ 已設定</span>
              : <span className="text-red-500 font-medium">❌ 未設定</span>}
          </div>
        </div>
        {(!hasClientId || !hasClientSecret) && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded px-3 py-2">
            ⚠️ OAuth 憑證未設定，UPS 查詢運費和建提單功能將無法使用。
            請至 Vercel → Settings → Environment Variables 新增。
          </p>
        )}
      </div>

      {/* UPS 帳號 & 折扣（可透過 UI 修改，存入 DB） */}
      <div className="bg-white rounded-lg border p-6 space-y-1">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📦</span>
          <h2 className="text-base font-semibold text-gray-800">UPS 帳號設定</h2>
          <span className="text-xs text-gray-400 ml-auto">存入資料庫，立即生效</span>
        </div>
        <UpsForm
          initialAccountNo={effective}
          source={source}
          initialMultiplier={multiplier}
        />
      </div>
    </div>
  )
}
