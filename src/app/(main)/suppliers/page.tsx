export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { prisma } from '@/lib/db'

type Props = { searchParams: { search?: string; page?: string } }

export default async function SuppliersPage({
  searchParams }: Props) {
    const search = searchParams.search ?? ''
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const limit = 20

  const where = search
    ? {
        isActive: true,
        OR: [
          { name: { contains: search } },
          { shortName: { contains: search } },
          { email: { contains: search } },
        ],
      }
    : { isActive: true }

  const [total, suppliers] = await Promise.all([
    prisma.sUP_Supplier.count({ where }),
    prisma.sUP_Supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { products: true } } },
    }),
  ])

  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">供應商管理</h1>
        <Link href="/suppliers/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          + 新增供應商
        </Link>
      </div>

      <form method="GET" className="mb-4 flex gap-2">
        <input name="search" defaultValue={search}
          placeholder="搜尋供應商名稱、Email..."
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-200">搜尋</button>
        {search && (
          <Link href="/suppliers" className="border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50 text-gray-500">清除</Link>
        )}
      </form>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">供應商名稱</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">簡稱</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">國家</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">付款條件</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">幣別</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">商品數</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {suppliers.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                {search ? `找不到「${search}」相關供應商` : '尚無供應商，請新增'}
              </td></tr>
            )}
            {suppliers.map((s: typeof suppliers[0]) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/suppliers/${s.id}`} className="font-medium text-blue-600 hover:underline">{s.name}</Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{s.shortName ?? '-'}</td>
                <td className="px-4 py-3 text-gray-500">{s.countryCode ?? '-'}</td>
                <td className="px-4 py-3 text-gray-500">{s.paymentTerms ?? '-'}</td>
                <td className="px-4 py-3 text-gray-500">{s.currencyCode ?? '-'}</td>
                <td className="px-4 py-3 text-right">
                  {s._count.products > 0
                    ? <Link href={`/products?supplierId=${s.id}`} className="text-blue-600 hover:underline">{s._count.products} 項</Link>
                    : <span className="text-gray-400">0</span>
                  }
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/suppliers/${s.id}/edit`} className="text-gray-400 hover:text-blue-600 text-xs">編輯</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm">
          <span className="text-gray-500">共 {total} 筆</span>
          <div className="flex gap-1 ml-auto">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <Link key={p} href={`/suppliers?search=${search}&page=${p}`}
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
