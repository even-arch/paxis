import Link from 'next/link'
import UpsForm from './UpsForm'

export const dynamic = 'force-dynamic'

export default async function UpsSettingsPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/${params.orgSlug}/admin/settings`} className="text-sm text-gray-400 hover:text-gray-600">← 系統設定</Link>
        <h2 className="font-semibold text-gray-800">UPS 設定</h2>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <UpsForm />
      </div>
    </div>
  )
}
