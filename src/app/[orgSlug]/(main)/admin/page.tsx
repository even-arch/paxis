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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">系統設定</h1>
        <p className="text-sm text-gray-400 mt-0.5">UPS 出貨與 AI 功能設定</p>
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
