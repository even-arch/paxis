import { notFound } from 'next/navigation'
import { masterPrisma } from '@/lib/master-db'
import InviteOnboardingForm from './InviteOnboardingForm'

export default async function InvitePage({ params }: { params: { token: string } }) {
  const invite = await masterPrisma.oRG_Invite.findUnique({
    where: { token: params.token },
    include: { org: { select: { slug: true } } },
  })

  if (!invite || invite.expiresAt < new Date()) {
    notFound()
  }

  if (invite.usedAt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-sm w-full text-center">
          <p className="text-gray-600">此邀請連結已使用過。</p>
          <p className="text-sm text-gray-400 mt-2">如有問題請聯繫 even@xinosys.com</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
      <div className="bg-white rounded-lg shadow p-8 w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800">歡迎加入 PAXIS</h1>
          <p className="text-sm text-gray-500 mt-1">請填寫公司基本資料，完成後將由管理員審核開通。</p>
        </div>
        <InviteOnboardingForm token={params.token} defaultEmail={invite.email} />
      </div>
    </div>
  )
}
