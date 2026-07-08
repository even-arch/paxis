import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPagePrisma } from '@/lib/page-db'
import OnboardingForm from './OnboardingForm'

export default async function OnboardingPage({
  params,
}: {
  params: { orgSlug: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect(`/login`)

  const prisma = await getPagePrisma(params.orgSlug)
  const company = await prisma.sYS_Company.findFirst()

  // 已填過就直接進系統
  if (company && (company.nameZh || company.nameEn || company.shortName)) {
    redirect(`/${params.orgSlug}/dashboard`)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-lg p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">歡迎使用 PAXIS</h1>
          <p className="mt-2 text-gray-500 text-sm">
            開始之前，請先填寫貴公司的基本資料。這些資料用於識別您在交易文件（PI、PO）中的公司名稱，讓系統自動匯入 Patisco 資料。
          </p>
        </div>
        <OnboardingForm orgSlug={params.orgSlug} />
      </div>
    </div>
  )
}
