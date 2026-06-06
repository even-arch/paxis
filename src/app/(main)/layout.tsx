import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCompanyProfile } from '@/lib/company'
import Sidebar from '@/components/Sidebar'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const company = await getCompanyProfile().catch(() => null)
  const companyName = company?.shortName || company?.nameZh || 'PAXIS'

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar companyName={companyName} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
