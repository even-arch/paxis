export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { getPagePrisma } from '@/lib/page-db'
import { orgPath } from '@/lib/org-path'
import { formatDate, formatCurrency } from '@/lib/utils'
import SortableHeader from '@/components/SortableHeader'

const SOURCE_LABELS: Record<string, string> = {
  PATISCO:   'Patisco',
  MANUAL:    '手動',
  AI_IMPORT: 'AI 匯入',
  UPS:       'UPS',
}

const VALID_SORTS = ['shipmentNo', 'actualShipDate', 'currencyCode', 'source', 'performedAt'] as const
type SortField = typeof VALID_SORTS[number]

type Props = {
  params: { orgSlug: string }
  searchParams: { search?: string; page?: string; sort?: string; dir?: string }
}

export default async function ShipmentsPage({ params, searchParams }: Props) {
  const prisma = await getPagePrisma(params.orgSlug)
  const search = searchParams.search ?? ''
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const sort: SortField = VALID_SORTS.includes(searchParams.sort as SortField) ? searchParams.sort as SortField : 'actualShipDate'
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc'
  const limit = 20

  const where: Record<string, unknown> = {}
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
        pis: {
          include: { pi: { select: { piNo: true } } },
          take: 3,
        },
      },
    }),
  ])

  const totalPages = Math.ceil(total / limit)

  function buildUrl(newSort: string, newDir: 'asc' | 'desc') {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    p.set('sort', newSort)
    p.set('dir', newDir)
    return `/shipments?${p.toString()}`
  }

  const sh = (label: string, field: string, align?: 'left' | 'right') => (
    <SortableHeader label={label} field={field} sort={sort} dir={dir} buildUrl={buildUrl} align={align} />
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">出貨單</h1>
        <Link href={orgPath(params.orgSlug, '/shipments/import')}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors">
          <span>📥</span>
          <span>AI 匯入出貨文件</span>
        </Link>
      </div>

      <form method="GET" className="mb-4 flex gap-2">
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <input name="search" defaultValue={search}
          placeholder="搜尋出貨單號、客戶名稱..."
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-200">搜尋</button>
        {search && (
          <Link href={orgPath(params.orgSlug, '/shipments')} className="border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50 text-gray-500">清除</Link>
        )}
      </form>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {sh('出貨單號', 'shipmentNo')}
              <th className="text-left px-4 py-3 font-medium text-gray-600">客戶</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">關聯 PI</th>
              {sh('出貨日期', 'actualShipDate')}
              <th className="text-left px-4 py-3 font-medium text-gray-600">裝貨港</th>
              {sh('幣別', 'currencyCode')}
              {sh('來源', 'source')}
              {sh('匯入日期', 'performedAt')}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shipments.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                {search ? `找不到「${search}」相關出貨單` : '尚無出貨單資料'}
              </td></tr>
            )}
            {shipments.map(s => {
              const customerName = s.customer?.shortName ?? s.customer?.name ?? '-'
              const piNos = s.pis.map(sp => sp.pi.piNo).join(', ')
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={orgPath(params.orgSlug, `/shipments/${s.id}`)} className="font-mono font-medium text-teal-600 hover:underline">
                      {s.shipmentNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{customerName}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                    {piNos || <span className="text-gray-300">-</span>}
                    {s._count.pis > 3 && <span className="text-gray-400"> +{s._count.pis - 3}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{formatDate(s.actualShipDate)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.portOfLoading ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.currencyCode ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{SOURCE_LABELS[s.source] ?? s.source}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(s.performedAt)}</td>
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
              <Link key={p} href={orgPath(params.orgSlug, `/shipments?search=${search}&sort=${sort}&dir=${dir}&page=${p}`)}
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
