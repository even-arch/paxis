import { requireAdminAuth } from '@/lib/admin-auth'
import { masterPrisma } from '@/lib/master-db'
import { getOrgPrisma } from '@/lib/org-db'
import { prisma as defaultPrisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import TenantUpsToggle from './TenantUpsToggle'

export const dynamic = 'force-dynamic'

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  await requireAdminAuth()

  const orgId = Number(params.id)
  const org = await masterPrisma.oRG.findUnique({ where: { id: orgId } })
  if (!org) notFound()

  // 讀取該租戶的 ups_mode
  let upsMode: 'disabled' | 'managed' = 'disabled'
  const isProvisioned = !!org.databaseUrl && !org.databaseUrl.startsWith('__pending__')
  if (isProvisioned) {
    try {
      const db = getOrgPrisma(org.databaseUrl, org.slug) as typeof defaultPrisma
      const row = await db.sYS_KeyValue.findUnique({ where: { key: 'ups_mode' } })
      if (row?.value === 'managed') upsMode = 'managed'
    } catch { /* DB 暫時無法連線 */ }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{org.name}</h1>
        <p className="text-sm text-gray-500">{org.slug} · {org.ownerEmail} · 狀態：{org.status}</p>
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="font-medium text-gray-800">UPS 代管服務</h2>
        <p className="text-sm text-gray-500">開啟後，此租戶可使用平台（錫諾系統）的 UPS 帳號出貨，享有合約折扣費率。</p>
        {!isProvisioned ? (
          <p className="text-sm text-gray-400">租戶 DB 尚未開通，無法設定。</p>
        ) : (
          <TenantUpsToggle tenantId={orgId} initialEnabled={upsMode === 'managed'} />
        )}
      </div>
    </div>
  )
}
