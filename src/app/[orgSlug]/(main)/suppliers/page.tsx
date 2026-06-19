export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { getPagePrisma } from '@/lib/page-db'
import { orgPath } from '@/lib/org-path'
import SupplierListClient from '@/modules/supplier/SupplierListClient'

type Props = {
  params: { orgSlug: string }
  searchParams: { search?: string; page?: string; sort?: string; dir?: string; archived?: string }
}

const VALID_SORTS = ['name', 'shortName', 'countryCode', 'currencyCode', 'createdAt'] as const
type SortField = typeof VALID_SORTS[number]

export default async function SuppliersPage({ params, searchParams }: Props) {
  const prisma = await getPagePrisma(params.orgSlug)
  const search = searchParams.search ?? ''
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const sort: SortField = VALID_SORTS.includes(searchParams.sort as SortField) ? searchParams.sort as SortField : 'name'
  const dir = searchParams.dir === 'desc' ? 'desc' : 'asc'
  const showArchived = searchParams.archived === 'true'
  const limit = 20

  const baseWhere: Record<string, unknown> = {
    isActive: true,
    archivedAt: showArchived ? { not: null } : null,
  }
  const where = search
    ? { ...baseWhere, OR: [{ name: { contains: search } }, { shortName: { contains: search } }, { email: { contains: search } }] }
    : baseWhere

  const [total, suppliers] = await Promise.all([
    prisma.sUP_Supplier.count({ where }),
    prisma.sUP_Supplier.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { products: true } } },
    }),
  ])

  const totalPages = Math.ceil(total / limit)

  const archiveToggleUrl = (() => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    p.set('sort', sort); p.set('dir', dir)
    if (!showArchived) p.set('archived', 'true')
    return orgPath(params.orgSlug, `/suppliers?${p.toString()}`)
  })()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">供應商管理</h1>
          {showArchived && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">封存檢視</span>}
        </div>
        <div className="flex gap-2">
          <Link href={archiveToggleUrl} className="border border-gray-300 text-gray-500 px-3 py-2 rounded-md text-sm hover:bg-gray-50">
            {showArchived ? '回到正常清單' : '🗄 封存清單'}
          </Link>
          {!showArchived && (
            <Link href={orgPath(params.orgSlug, '/suppliers/new')} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
              + 新增供應商
            </Link>
          )}
        </div>
      </div>

      <form method="GET" className="mb-4 flex gap-2">
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        {showArchived && <input type="hidden" name="archived" value="true" />}
        <input name="search" defaultValue={search} placeholder="搜尋供應商名稱、Email..."
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-200">搜尋</button>
        {search && (
          <Link href={showArchived ? orgPath(params.orgSlug, '/suppliers?archived=true') : orgPath(params.orgSlug, '/suppliers')}
            className="border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50 text-gray-500">清除</Link>
        )}
      </form>

      <SupplierListClient suppliers={suppliers} isArchived={showArchived} sort={sort} dir={dir} />

      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm">
          <span className="text-gray-500">共 {total} 筆</span>
          <div className="flex gap-1 ml-auto">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
              const pp = new URLSearchParams()
              if (search) pp.set('search', search)
              if (showArchived) pp.set('archived', 'true')
              pp.set('sort', sort); pp.set('dir', dir); pp.set('page', String(p))
              return (
                <Link key={p} href={orgPath(params.orgSlug, `/suppliers?${pp.toString()}`)}
                  className={`px-3 py-1 rounded-md ${p === page ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
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
