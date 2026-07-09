import { requireAdminAuth } from '@/lib/admin-auth'
import EmailForm from './EmailForm'

export const dynamic = 'force-dynamic'

export default async function AdminEmailSettingsPage() {
  await requireAdminAuth()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">郵件設定</h1>
        <p className="text-sm text-gray-400 mt-0.5">設定系統信（邀請信等）的 Resend 帳號</p>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xl">✉️</span>
          <h2 className="text-base font-semibold text-gray-800">Resend 設定</h2>
        </div>
        <EmailForm />
      </div>
    </div>
  )
}
