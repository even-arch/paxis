export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatDate, formatCurrency } from '@/lib/utils'

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: '草稿',    color: 'bg-gray-100 text-gray-600' },
  1: { label: '已確認',  color: 'bg-blue-100 text-blue-700' },
  2: { label: 'PI 已發', color: 'bg-purple-100 text-purple-700' },
  3: { label: '部分出貨', color: 'bg-amber-100 text-amber-700' },
  4: { label: '完成',    color: 'bg-green-100 text-green-700' },
  5: { label: '取消',    color: 'bg-red-100 text-red-600' },
}

const SOURCE_LABELS: Record<string, string> = {
  PATISCO:   'Patisco',
  MANUAL:    '手動',
  AI_IMPORT: 'AI 匯入',
}

type Props = { searchParams: { search?: string; page?: string; customerId?: string } }

export default async function SalesPage({
  searchParams }: Props) {
    const search = searchParams.search ?? ''
  const customerId = searchParams.customerId ? Number(searchParams.customerId) : undefined
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const limit = 20

  const where: Record<string, unknown> = {}
  if (customerId) where.customerId = customerId
  if (search) {
    where.OR = [
      { orderNo: { contains: search } },
      { customer: { name: { contains: search } } },
      { patiscoBuyerName: { contains: search } },
    ]
  }

  const [total, orders] = await Promise.all([
    prisma.sLS_Order.count({ where }),
    prisma.sLS_Order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: { select: { name: true, shortName: true } },
        _count: { select: { items: true } },
      },
    }),
  ])

  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">客戶訂單</h1>
        <div className="flex gap-2">
          <Link href="/sales/import"
            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700">
            ✨ AI 匯入
          </Link>
          <Link href="/sales/new"
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50">
            + 手動建立
          </Link>
        </div>
      </div>

      <form method="GET" className="mb-4 flex gap-2">
        <input name="search" defaultValue={search}
          placeholder="搜尋訂單號、客戶名稱..."
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-200">搜尋</button>
        {(search || customerId) && (
          <Link href="/sales" className="border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50 text-gray-500">清除</Link>
        )}
      </form>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">訂單號</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">客戶</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">幣別</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">金額</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">狀態</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">來源</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">希望出貨日</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">建立日期</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                {search ? `找不到「${search}」相關訂單` : '尚無客戶訂單'}
              </td></tr>
            )}
            {orders.map(o => {
              const badge = STATUS_LABELS[o.status] ?? STATUS_LABELS[0]
              const customerName = o.customer?.name ?? o.patiscoBuyerName ?? '-'
              return (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/sales/${o.id}`} className="font-mono font-medium text-teal-600 hover:underline">
                      {o.orderNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{customerName}</td>
                  <td className="px-4 py-3 text-gray-500">{o.currencyCode}</td>
                  <td className="px-4 py-3 text-right">
                    {o.totalAmount ? formatCurrency(o.totalAmount.toString(), o.currencyCode) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>{badge.label}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{SOURCE_LABELS[o.source] ?? o.source}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {o.customerRequestedShipDate ? formatDate(o.customerRequestedShipDate) : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(o.createdAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm">
          <span className="text-gray-500">共 {total} 筆</span>
          <div className="flex gap-1 ml-auto">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <Link key={p} href={`/sales?search=${search}&page=${p}`}
                className={`px-3 py-1 rounded-md ${p === page ? 'bg-teal-600 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                {p}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
