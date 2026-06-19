export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { getPagePrisma } from '@/lib/page-db'
import { orgPath } from '@/lib/org-path'
import SalesListClient from '@/modules/sales/SalesListClient'

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: '草稿',    color: 'bg-gray-100 text-gray-600' },
  1: { label: '已確認',  color: 'bg-blue-100 text-blue-700' },
  2: { label: 'PI 已發', color: 'bg-purple-100 text-purple-700' },
  3: { label: '部分出貨', color: 'bg-amber-100 text-amber-700' },
  4: { label: '完成',    color: 'bg-green-100 text-green-700' },
  5: { label: '取消',    color: 'bg-red-100 text-red-600' },
}

const SOURCE_LABELS: Record<string, string> = {
  PATISCO:     'Patisco',
  MANUAL:      '手動',
  AI_IMPORT:   'AI 匯入',
  MARKETPLACE: '電商平台',
}

const STATUS_OPTIONS = [
  { value: '', label: '全部狀態' },
  { value: '0', label: '草稿' },
  { value: '1', label: '已確認' },
  { value: '2', label: 'PI 已發' },
  { value: '3', label: '部分出貨' },
  { value: '4', label: '完成' },
  { value: '5', label: '取消' },
]

const VALID_SORTS = ['orderNo', 'currencyCode', 'totalAmount', 'status', 'source', 'patiscoCreatedAt'] as const
type SortField = typeof VALID_SORTS[number]

type Props = {
  params: { orgSlug: string }
  searchParams: {
    search?: string; sku?: string; status?: string
    customerId?: string; page?: string; sort?: string; dir?: string
    archived?: string
  }
}

export default async function SalesPage({ params, searchParams }: Props) {
  const prisma = await getPagePrisma(params.orgSlug)
  const search     = searchParams.search ?? ''
  const sku        = searchParams.sku ?? ''
  const statusFilter = searchParams.status ?? ''
  const customerId = searchParams.customerId ? Number(searchParams.customerId) : undefined
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const sort: SortField = VALID_SORTS.includes(searchParams.sort as SortField) ? searchParams.sort as SortField : 'patiscoCreatedAt'
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc'
  const showArchived = searchParams.archived === 'true'
  const limit = 20

  const where: Record<string, unknown> = {
    archivedAt: showArchived ? { not: null } : null,
  }
  if (customerId) where.customerId = customerId
  if (statusFilter !== '') where.status = Number(statusFilter)
  if (sku) {
    where.items = { some: { product: { sku: { contains: sku, mode: 'insensitive' } } } }
  }
  if (search) {
    where.OR = [
      { orderNo: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { patiscoBuyerName: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [total, orders, customers] = await Promise.all([
    prisma.sLS_Order.count({ where }),
    prisma.sLS_Order.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: { select: { name: true, shortName: true } },
        _count: { select: { items: true } },
        pis: {
          select: { etd: true },
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.cUS_Customer.findMany({
      select: { id: true, name: true, shortName: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const totalPages = Math.ceil(total / limit)
  const hasFilter = !!(search || sku || statusFilter || customerId)

  function buildUrl(newSort: string, newDir: 'asc' | 'desc') {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (sku) p.set('sku', sku)
    if (statusFilter) p.set('status', statusFilter)
    if (customerId) p.set('customerId', String(customerId))
    if (showArchived) p.set('archived', 'true')
    p.set('sort', newSort)
    p.set('dir', newDir)
    return orgPath(params.orgSlug, `/sales?${p.toString()}`)
  }

  const archiveToggleUrl = (() => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (sku) p.set('sku', sku)
    if (statusFilter) p.set('status', statusFilter)
    if (customerId) p.set('customerId', String(customerId))
    if (!showArchived) p.set('archived', 'true')
    return orgPath(params.orgSlug, `/sales?${p.toString()}`)
  })()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">客戶訂單</h1>
          {showArchived && (
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">封存檢視</span>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={archiveToggleUrl}
            className="border border-gray-300 text-gray-500 px-3 py-2 rounded-md text-sm hover:bg-gray-50">
            {showArchived ? '回到正常清單' : '🗄 封存清單'}
          </Link>
          {!showArchived && (
            <>
              <Link href={orgPath(params.orgSlug, '/sales/import')}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700">
                ✨ AI 匯入
              </Link>
              <Link href={orgPath(params.orgSlug, '/sales/new')}
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50">
                + 手動建立
              </Link>
            </>
          )}
        </div>
      </div>

      <form method="GET" className="mb-4 flex gap-2 flex-wrap">
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        {showArchived && <input type="hidden" name="archived" value="true" />}
        <input name="search" defaultValue={search}
          placeholder="搜尋訂單號..."
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        <input name="sku" defaultValue={sku}
          placeholder="產品 SKU..."
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        <select name="customerId" defaultValue={customerId ?? ''}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">全部客戶</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.shortName ?? c.name}</option>
          ))}
        </select>
        <select name="status" defaultValue={statusFilter}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="submit" className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-200">搜尋</button>
        {hasFilter && (
          <Link href={showArchived ? orgPath(params.orgSlug, '/sales?archived=true') : orgPath(params.orgSlug, '/sales')}
            className="border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50 text-gray-500">清除</Link>
        )}
      </form>

      <SalesListClient orders={orders} isArchived={showArchived} sort={sort} dir={dir} />

      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm">
          <span className="text-gray-500">共 {total} 筆</span>
          <div className="flex gap-1 ml-auto">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
              const pp = new URLSearchParams()
              if (search) pp.set('search', search)
              if (sku) pp.set('sku', sku)
              if (statusFilter) pp.set('status', statusFilter)
              if (customerId) pp.set('customerId', String(customerId))
              if (showArchived) pp.set('archived', 'true')
              pp.set('sort', sort); pp.set('dir', dir); pp.set('page', String(p))
              return (
                <Link key={p} href={orgPath(params.orgSlug, `/sales?${pp.toString()}`)}
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
