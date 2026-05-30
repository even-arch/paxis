import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import { statusBadge } from '@/modules/purchase/poUtils'

type Props = { searchParams: { search?: string; status?: string; page?: string } }

export default async function PurchasesPage({ searchParams }: Props) {
  const search = searchParams.search ?? ''
  const statusFilter = searchParams.status ?? ''
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const limit = 20

  const where: Record<string, unknown> = {}
  if (statusFilter !== '') where.status = Number(statusFilter)
  if (search) {
    where.OR = [
      { poNo: { contains: search } },
      { patiscoOrderNo: { contains: search } },
      { supplier: { name: { contains: search } } },
    ]
  }

  const [total, orders] = await Promise.all([
    prisma.pO_Order.count({ where }),
    prisma.pO_Order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        supplier: { select: { name: true, shortName: true } },
        _count: { select: { items: true } },
      },
    }),
  ])

  const totalPages = Math.ceil(total / limit)
  const statusOptions = [
    { value: '', label: '全部狀態' },
    { value: '0', label: '草稿' },
    { value: '1', label: '已送出' },
    { value: '2', label: '部分到貨' },
    { value: '3', label: '完成' },
    { value: '4', label: '取消' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">採購單</h1>
        <Link href="/purchases/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          + 新增採購單
        </Link>
      </div>

      <form method="GET" className="mb-4 flex gap-2 flex-wrap">
        <input name="search" defaultValue={search}
          placeholder="搜尋採購單號、Patisco 訂單號、供應商..."
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select name="status" defaultValue={statusFilter}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="submit" className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-200">搜尋</button>
        {(search || statusFilter) && (
          <Link href="/purchases" className="border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50 text-gray-500">清除</Link>
        )}
      </form>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">採購單號</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Patisco 訂單</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">供應商</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">狀態</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">預計到貨</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">項目</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">建立日期</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                尚無採購單
              </td></tr>
            )}
            {orders.map((o: typeof orders[0]) => {
              const badge = statusBadge(o.status)
              return (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/purchases/${o.id}`} className="font-medium text-blue-600 hover:underline font-mono">
                      {o.poNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {o.patiscoOrderNo ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {o.supplier.shortName ?? o.supplier.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{o.expectedDate ? formatDate(o.expectedDate) : '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{o._count.items}</td>
                  <td className="px-4 py-3 text-gray-400">{formatDate(o.createdAt)}</td>
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
              <Link key={p} href={`/purchases?search=${search}&status=${statusFilter}&page=${p}`}
                className={`px-3 py-1 rounded-md ${p === page ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                {p}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
