import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPagePrisma } from '@/lib/page-db'
import { formatDate } from '@/lib/utils'
import { orgPath } from '@/lib/org-path'
import ShippingNoticeDetail from './ShippingNoticeDetail'

export default async function ShippingNoticeDetailPage({
  params,
}: {
  params: { orgSlug: string; id: string }
}) {
  const prisma = await getPagePrisma(params.orgSlug)
  const id = parseInt(params.id, 10)
  if (isNaN(id)) notFound()

  const notice = await prisma.pO_ShippingNotice.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, email: true, contactPerson: true } },
      items: {
        include: {
          po: { select: { id: true, poNo: true } },
          product: { select: { id: true, sku: true, name: true, unit: true } },
        },
      },
      performer: { select: { id: true, name: true } },
    },
  })

  if (!notice) notFound()

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={orgPath(params.orgSlug, '/purchases/shipping-notices')} className="text-gray-400 hover:text-gray-600 text-sm">
          ← 通知單列表
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-800 font-mono">{notice.noticeNo}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full ${notice.status === 'DRAFT' ? 'bg-gray-100 text-gray-600' : notice.status === 'SENT' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
          {notice.status === 'DRAFT' ? '草稿' : notice.status === 'SENT' ? '已寄送' : '已確認'}
        </span>
      </div>

      <ShippingNoticeDetail notice={notice} />
    </div>
  )
}
