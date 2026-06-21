export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { getPagePrisma } from '@/lib/page-db'
import { orgPath } from '@/lib/org-path'
import PIListClient from '@/modules/sales/PIListClient'

const VALID_SORTS = ['piNo', 'piDate', 'estimatedShipDate', 'patiscoCreatedAt'] as const
type SortField = typeof VALID_SORTS[number]

type Props = {
  params: { orgSlug: string }
  searchParams: { search?: string; page?: string; archived?: string; sort?: string; dir?: string }
}

export default async function PIListPage({ params, searchParams }: Props) {
  const prisma = await getPagePrisma(params.orgSlug)
  const search = searchParams.search ?? ''
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const showArchived = searchParams.archived === 'true'
  const sort: SortField = VALID_SORTS.includes(searchParams.sort as SortField) ? searchParams.sort as SortField : 'patiscoCreatedAt'
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc'
  const limit = 30

  const where: Record<string, unknown> = {
    archivedAt: showArchived ? { not: null } : null,
  }
  if (search) {
    where.OR = [
      { piNo: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { order: { customer: { name: { contains: search, mode: 'insensitive' } } } },
      { order: { orderNo: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const [total, pis] = await Promise.all([
    prisma.sLS_PI.count({ where }),
    prisma.sLS_PI.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: { select: { name: true, shortName: true } },
        order: { select: { id: true, orderNo: true, customer: { select: { name: true, shortName: true } } } },
        _count: { select: { items: true } },
      },
    }),
  ])

  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href={orgPath(params.orgSlug, '/sales')} className="text-gray-400 hover:text-gray-600 text-sm">← 客戶訂單</Link>
          <h1 className="text-2xl font-bold text-gray-800">我方 PI 清單</h1>
        </div>
        <Link href={showArchived ? orgPath(params.orgSlug, '/sales/pi') : orgPath(params.orgSlug, '/sales/pi?archived=true')}
          className={`text-sm px-3 py-2 rounded-md border ${showArchived ? 'bg-gray-100 border-gray-300 text-gray-700' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
          {showArchived ? '查看現有 PI' : '查看封存 PI'}
        </Link>
      </div>

      <form method="GET" className="mb-4 flex gap-2">
        {showArchived && <input type="hidden" name="archived" value="true" />}
        <input name="search" defaultValue={search}
          placeholder="搜尋 PI 號碼、客戶名稱、訂單號..."
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        <button type="submit" className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-200">搜尋</button>
        {search && (
          <a href={orgPath(params.orgSlug, showArchived ? '/sales/pi?archived=true' : '/sales/pi')}
            className="border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50 text-gray-500">清除</a>
        )}
      </form>

      <PIListClient pis={pis} isArchived={showArchived} sort={sort} dir={dir} />

      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm">
          <span className="text-gray-500">共 {total} 筆</span>
          <div className="flex gap-1 ml-auto">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
              const pp = new URLSearchParams({ search, page: String(p) })
              if (showArchived) pp.set('archived', 'true')
              return (
                <Link key={p} href={orgPath(params.orgSlug, `/sales/pi?${pp.toString()}`)}
                  className={`px-3 py-1 rounded-md ${p === page ? 'bg-teal-600 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                  {p}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
