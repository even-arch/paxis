export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { getPagePrisma } from '@/lib/page-db'
import { formatDate } from '@/lib/utils'
import { orgPath } from '@/lib/org-path'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  SENT: '已寄送',
  CONFIRMED: '已確認',
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-50 text-blue-700',
  CONFIRMED: 'bg-green-50 text-green-700',
}

export default async function ShippingNoticesPage({ params }: { params: { orgSlug: string } }) {
  const prisma = await getPagePrisma(params.orgSlug)
  const notices = await prisma.pO_ShippingNotice.findMany({
    include: {
      supplier: { select: { id: true, name: true, shortName: true } },
      items: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">出貨通知單</h1>
        <Link href={orgPath(params.orgSlug, '/purchases/shipping-notices/new')} className="bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-2 rounded-lg">
          + 新增通知單
        </Link>
      </div>

      {notices.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400 text-sm">
          尚無出貨通知單。點右上角「+ 新增通知單」建立第一張。
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">通知單號</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">供應商</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">通知日期</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">品項</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {notices.map(n => (
                <tr key={n.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={orgPath(params.orgSlug, `/purchases/shipping-notices/${n.id}`)} className="font-mono text-teal-600 hover:underline text-xs">
                      {n.noticeNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{n.supplier?.shortName ?? n.supplier?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(n.issueDate)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{n.items.length}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[n.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABEL[n.status] ?? n.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
