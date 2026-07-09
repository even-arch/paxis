import { requireAdminAuth } from '@/lib/admin-auth'
import { masterPrisma } from '@/lib/master-db'
import { getOrgPrisma } from '@/lib/org-db'
import { prisma as defaultPrisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import UpsForm from './UpsForm'

export const dynamic = 'force-dynamic'

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  await requireAdminAuth()

  const orgId = Number(params.id)
  const org = await masterPrisma.oRG.findUnique({ where: { id: orgId } })
  if (!org) notFound()

  let upsMode: 'managed' | 'disabled' = 'disabled'
  let ownAccountNo: string | null = null
  const isProvisioned = !!org.databaseUrl && !org.databaseUrl.startsWith('__pending__')
  if (isProvisioned) {
    try {
      const db = getOrgPrisma(org.databaseUrl, org.slug) as typeof defaultPrisma
      const [modeRow, accountRow] = await Promise.all([
        db.sYS_KeyValue.findUnique({ where: { key: 'ups_mode' } }),
        db.sYS_KeyValue.findUnique({ where: { key: 'ups_own_account_no' } }),
      ])
      if (modeRow?.value === 'managed') upsMode = 'managed'
      ownAccountNo = accountRow?.value?.trim() || null
    } catch { /* DB 暫時無法連線 */ }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{org.name}</h1>
        <p className="text-sm text-gray-500">{org.slug} · {org.ownerEmail} · 狀態：{org.status}</p>
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="font-medium text-gray-800">UPS 服務設定</h2>
        <p className="text-sm text-gray-500">選擇此租戶使用平台代管 UPS 或其自有帳號。</p>
        {!isProvisioned ? (
          <p className="text-sm text-gray-400">租戶 DB 尚未開通，無法設定。</p>
        ) : (
          <UpsForm
            tenantId={orgId}
            initialMode={upsMode === 'managed' ? 'managed' : 'own'}
            initialAccountNo={ownAccountNo}
          />
        )}
      </div>
    </div>
  )
}
