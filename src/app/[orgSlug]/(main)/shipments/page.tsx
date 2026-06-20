export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { getPagePrisma } from '@/lib/page-db'
import { orgPath } from '@/lib/org-path'
import ShipmentListClient from '@/modules/shipment/ShipmentListClient'

const VALID_SORTS = ['shipmentNo', 'actualShipDate', 'currencyCode', 'source', 'performedAt', 'doCreatedDate'] as const
type SortField = typeof VALID_SORTS[number]

type Props = {
  params: { orgSlug: string }
  searchParams: { search?: string; page?: string; sort?: string; dir?: string; archived?: string }
}

export default async function ShipmentsPage({ params, searchParams }: Props) {
  const prisma = await getPagePrisma(params.orgSlug)
  const search = searchParams.search ?? ''
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const sort: SortField = VALID_SORTS.includes(searchParams.sort as SortField) ? searchParams.sort as SortField : 'doCreatedDate'
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc'
  const showArchived = searchParams.archived === 'true'
  const limit = 20

  const where: Record<string, unknown> = {
    archivedAt: showArchived ? { not: null } : null,
  }
  if (search) {
    where.OR = [
      { shipmentNo: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { patiscoDocNo: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [total, shipments] = await Promise.all([
    prisma.sLS_Shipment.count({ where }),
    prisma.sLS_Shipment.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: { select: { name: true, shortName: true } },
        _count: { select: { items: true, pis: true } },
        pis: { include: { pi: { select: { piNo: true } } }, take: 3 },
      },
    }),
  ])

  const totalPages = Math.ceil(total / limit)

  function buildUrl(newSort: string, newDir: 'asc' | 'desc') {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (showArchived) p.set('archived', 'true')
    p.set('sort', newSort)
    p.set('dir', newDir)
    return `/shipments?${p.toString()}`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">出貨單</h1>
        <div className="flex gap-2">
          <Link href={showArchived ? orgPath(params.orgSlug, '/shipments') : orgPath(params.orgSlug, '/shipments?archived=true')}
            className={`text-sm px-3 py-2 rounded-md border ${showArchived ? 'bg-gray-100 border-gray-300 text-gray-700' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
            {showArchived ? '查看現有出貨單' : '查看封存出貨單'}
          </Link>
          {!showArchived && (
            <Link href={orgPath(params.orgSlug, '/shipments/import')}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors">
              <span>📥</span><span>AI 匯入出貨文件</span>
            </Link>
          )}
        </div>
      </div>

      <form method="GET" className="mb-4 flex gap-2">
        {showArchived && <input type="hidden" name="archived" value="true" />}
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <input name="search" defaultValue={search}
          placeholder="搜尋出貨單號、客戶名稱..."
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        <button type="submit" className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-200">搜尋</button>
        {search && (
          <Link href={orgPath(params.orgSlug, showArchived ? '/shipments?archived=true' : '/shipments')}
            className="border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50 text-gray-500">清除</Link>
        )}
      </form>

      <ShipmentListClient shipments={shipments} isArchived={showArchived} sort={sort} dir={dir} />

      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm">
          <span className="text-gray-500">共 {total} 筆</span>
          <div className="flex gap-1 ml-auto">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
              const pp = new URLSearchParams({ search, sort, dir, page: String(p) })
              if (showArchived) pp.set('archived', 'true')
              return (
                <Link key={p} href={orgPath(params.orgSlug, `/shipments?${pp.toString()}`)}
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
