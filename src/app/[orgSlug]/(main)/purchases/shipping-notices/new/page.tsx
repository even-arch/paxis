import Link from 'next/link'
import { getPagePrisma } from '@/lib/page-db'
import { orgPath } from '@/lib/org-path'
import ShippingNoticeForm from '../ShippingNoticeForm'

export default async function NewShippingNoticePage({ params }: { params: { orgSlug: string } }) {
  const prisma = await getPagePrisma(params.orgSlug)
  const suppliers = await prisma.sUP_Supplier.findMany({
    where: { isActive: true, archivedAt: null },
    select: { id: true, name: true, shortName: true, email: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={orgPath(params.orgSlug, '/purchases/shipping-notices')} className="text-gray-400 hover:text-gray-600 text-sm">
          ← 通知單列表
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-800">新增出貨通知單</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="text-sm text-gray-600 space-y-2">
          <p>• 選擇供應商後，系統會列出該供應商的訂單</p>
          <p>• 可直接帶入整張訂單的全部品項，或手動調整通知數量</p>
          <p>• 建立後可預覽內容，然後透過 Email 發送給供應商</p>
        </div>
      </div>

      <ShippingNoticeForm suppliers={suppliers} orgSlug={params.orgSlug} />
    </div>
  )
}
