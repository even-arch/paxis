import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { masterPrisma } from '@/lib/master-db'
import { getOrgPrisma } from '@/lib/org-db'
import Sidebar from '@/components/Sidebar'

export default async function MainLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect(`/${params.orgSlug}/login`)

  const org = await masterPrisma.oRG.findUnique({
    where: { slug: params.orgSlug },
    select: { databaseUrl: true, status: true },
  })

  if (!org || org.status !== 'active') notFound()

  const db = getOrgPrisma(org.databaseUrl, params.orgSlug)

  let companyName = 'PAXIS'
  try {
    const company = await db.sYS_Company.findFirst()
    companyName = company?.shortName || company?.nameZh || 'PAXIS'
  } catch { /* schema 尚未建好時不 crash */ }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar companyName={companyName} orgSlug={params.orgSlug} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
