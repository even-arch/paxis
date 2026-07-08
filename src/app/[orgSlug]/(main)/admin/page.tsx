import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import UpsForm from './settings/ups/UpsForm'

export const dynamic = 'force-dynamic'

export default async function AdminPage({ params }: { params: { orgSlug: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect(`/${params.orgSlug}/login`)
  }

  // OAuth 憑證只能存環境變數，這裡只看有沒有設
  const hasClientId     = !!process.env.UPS_CLIENT_ID
  const hasClientSecret = !!process.env.UPS_CLIENT_SECRET

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">系統設定</h1>
        <p className="text-sm text-gray-400 mt-0.5">UPS 出貨與 AI 功能設定</p>
      </div>

      {/* UPS OAuth 憑證狀態（唯讀，只能改 Vercel 環境變數） */}
      <div className="bg-white rounded-lg border p-6 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🔑</span>
          <h2 className="text-base font-semibold text-gray-800">UPS OAuth 憑證</h2>
          <span className="text-xs text-gray-400 ml-auto">平台層級設定，唯讀</span>
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
      </div>

      {/* UPS 帳號設定 */}
      <div className="bg-white rounded-lg border p-6 space-y-1">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📦</span>
          <h2 className="text-base font-semibold text-gray-800">UPS 帳號設定</h2>
        </div>
        <UpsForm />
      </div>
    </div>
  )
}
