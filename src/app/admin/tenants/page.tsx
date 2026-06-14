import { requireAdminAuth } from '@/lib/admin-auth'
import { masterPrisma } from '@/lib/master-db'
import InviteForm from './InviteForm'
import OrgActions from './OrgActions'

export default async function TenantsPage() {
  await requireAdminAuth()

  const orgs = await masterPrisma.oRG.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      ownerEmail: true,
      createdAt: true,
      databaseUrl: true,
    },
  })

  const statusLabel: Record<string, string> = {
    pending: '待啟用',
    active: '啟用中',
    suspended: '已停用',
  }
  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    suspended: 'bg-red-100 text-red-800',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">租戶管理</h2>
        <InviteForm />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Slug</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">公司名稱</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">負責人 Email</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">狀態</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">建立時間</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orgs.map(org => (
              <tr key={org.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{org.slug}</td>
                <td className="px-4 py-3 text-gray-800">{org.name || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{org.ownerEmail}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[org.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {statusLabel[org.status] ?? org.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(org.createdAt).toLocaleDateString('zh-TW')}
                </td>
                <td className="px-4 py-3">
                  <OrgActions orgId={org.id} currentStatus={org.status} hasDatabaseUrl={!!org.databaseUrl} />
                </td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  尚無租戶
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
