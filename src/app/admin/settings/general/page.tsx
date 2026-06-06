import { getSystemSetting, setSystemSetting } from '@/lib/system-settings'
import Link from 'next/link'
import GeneralForm from './GeneralForm'

export const dynamic = 'force-dynamic'

export default async function GeneralSettingsPage() {
  const allowDeleteSetting = await getSystemSetting('allow_tenant_delete')
  const allowDelete = allowDeleteSetting === 'true'

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/settings" className="text-sm text-gray-400 hover:text-gray-600">← 系統設定</Link>
        <h2 className="font-semibold text-gray-800">一般設定</h2>
      </div>
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Feature Flags</h3>
        <GeneralForm initialAllowDelete={allowDelete} />
      </div>
    </div>
  )
}
