export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import SortableHeader from '@/components/SortableHeader'

type Props = { searchParams: { search?: string; page?: string; sort?: string; dir?: string } }

const VALID_SORTS = ['name', 'shortName', 'countryCode', 'currencyCode', 'createdAt'] as const
type SortField = typeof VALID_SORTS[number]

export default async function CustomersPage({ searchParams }: Props) {
  const search = searchParams.search ?? ''
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const sort: SortField = VALID_SORTS.includes(searchParams.sort as SortField) ? searchParams.sort as SortField : 'name'
  const dir = searchParams.dir === 'desc' ? 'desc' : 'asc'
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

  const [total, customers] = await Promise.all([
    prisma.cUS_Customer.count({ where }),
    prisma.cUS_Customer.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { salesOrders: true } } },
    }),
  ])

  const totalPages = Math.ceil(total / limit)

  function buildUrl(newSort: string, newDir: 'asc' | 'desc') {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    p.set('sort', newSort)
    p.set('dir', newDir)
    return `/customers?${p.toString()}`
  }

  const sh = (label: string, field: string, align?: 'left' | 'right') => (
    <SortableHeader label={label} field={field} sort={sort} dir={dir} buildUrl={buildUrl} align={align} />
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">客戶管理</h1>
        <Link href="/customers/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          + 新增客戶
        </Link>
      </div>

      <form method="GET" className="mb-4 flex gap-2">
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <input name="search" defaultValue={search}
          placeholder="搜尋客戶名稱、Email..."
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-200">搜尋</button>
        {search && (
          <Link href="/customers" className="border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50 text-gray-500">清除</Link>
        )}
      </form>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {sh('客戶名稱', 'name')}
              {sh('簡稱', 'shortName')}
              {sh('國家', 'countryCode')}
              <th className="text-left px-4 py-3 font-medium text-gray-600">付款條件</th>
              {sh('幣別', 'currencyCode')}
              <th className="text-right px-4 py-3 font-medium text-gray-600">訂單數</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                {search ? `找不到「${search}」相關客戶` : '尚無客戶，請新增'}
              </td></tr>
            )}
            {customers.map((c: typeof customers[0]) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/customers/${c.id}`} className="font-medium text-blue-600 hover:underline">{c.name}</Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{c.shortName ?? '-'}</td>
                <td className="px-4 py-3 text-gray-500">{c.countryCode ?? '-'}</td>
                <td className="px-4 py-3 text-gray-500">{c.paymentTerms ?? '-'}</td>
                <td className="px-4 py-3 text-gray-500">{c.currencyCode ?? '-'}</td>
                <td className="px-4 py-3 text-right">
                  {c._count.salesOrders > 0
                    ? <span className="text-blue-600">{c._count.salesOrders} 筆</span>
                    : <span className="text-gray-400">0</span>
                  }
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/customers/${c.id}/edit`} className="text-gray-400 hover:text-blue-600 text-xs">編輯</Link>
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
              <Link key={p} href={`/customers?search=${search}&sort=${sort}&dir=${dir}&page=${p}`}
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
