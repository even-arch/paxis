export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import { statusBadge } from '@/modules/purchase/poUtils'
import SortableHeader from '@/components/SortableHeader'

const VALID_SORTS = ['poNo', 'patiscoOrderNo', 'status', 'expectedDate', 'orderDate'] as const
type SortField = typeof VALID_SORTS[number]

type Props = {
  searchParams: {
    search?: string; sku?: string; status?: string
    supplierId?: string; page?: string; sort?: string; dir?: string
  }
}

export default async function PurchasesPage({ searchParams }: Props) {
  const search = searchParams.search ?? ''
  const sku = searchParams.sku ?? ''
  const statusFilter = searchParams.status ?? ''
  const supplierId = searchParams.supplierId ? Number(searchParams.supplierId) : undefined
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const sort: SortField = VALID_SORTS.includes(searchParams.sort as SortField) ? searchParams.sort as SortField : 'orderDate'
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc'
  const limit = 20

  const where: Record<string, unknown> = {}
  if (statusFilter !== '') where.status = Number(statusFilter)
  if (supplierId) where.supplierId = supplierId
  if (sku) {
    where.items = { some: { product: { sku: { contains: sku, mode: 'insensitive' } } } }
  }
  if (search) {
    where.OR = [
      { poNo: { contains: search, mode: 'insensitive' } },
      { patiscoOrderNo: { contains: search, mode: 'insensitive' } },
      { supplier: { name: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const [total, orders, suppliers] = await Promise.all([
    prisma.pO_Order.count({ where }),
    prisma.pO_Order.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        supplier: { select: { name: true, shortName: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.sUP_Supplier.findMany({
      select: { id: true, name: true, shortName: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const totalPages = Math.ceil(total / limit)
  const hasFilter = !!(search || sku || statusFilter || supplierId)
  const statusOptions = [
    { value: '', label: '全部狀態' },
    { value: '0', label: '草稿' },
    { value: '1', label: '已送出' },
    { value: '2', label: '部分到貨' },
    { value: '3', label: '完成' },
    { value: '4', label: '取消' },
  ]

  function buildUrl(newSort: string, newDir: 'asc' | 'desc') {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (sku) p.set('sku', sku)
    if (statusFilter) p.set('status', statusFilter)
    if (supplierId) p.set('supplierId', String(supplierId))
    p.set('sort', newSort)
    p.set('dir', newDir)
    return `/purchases?${p.toString()}`
  }

  const sh = (label: string, field: string, align?: 'left' | 'right') => (
    <SortableHeader label={label} field={field} sort={sort} dir={dir} buildUrl={buildUrl} align={align} />
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">供應商訂單</h1>
        <div className="flex gap-2">
          <Link href="/purchases/import"
            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700">
            ✨ AI 匯入
          </Link>
          <Link href="/purchases/new"
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50">
            + 手動建立
          </Link>
        </div>
      </div>

      <form method="GET" className="mb-4 flex gap-2 flex-wrap">
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <input name="search" defaultValue={search}
          placeholder="搜尋訂單號..."
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input name="sku" defaultValue={sku}
          placeholder="產品 SKU..."
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select name="supplierId" defaultValue={supplierId ?? ''}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">全部供應商</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.shortName ?? s.name}</option>
          ))}
        </select>
        <select name="status" defaultValue={statusFilter}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="submit" className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-200">搜尋</button>
        {hasFilter && (
          <Link href="/purchases" className="border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50 text-gray-500">清除</Link>
        )}
      </form>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {sh('供應商訂單號', 'poNo')}
              {sh('Patisco 訂單', 'patiscoOrderNo')}
              <th className="text-left px-4 py-3 font-medium text-gray-600">供應商</th>
              {sh('狀態', 'status')}
              {sh('預計到貨', 'expectedDate')}
              <th className="text-right px-4 py-3 font-medium text-gray-600">項目</th>
              {sh('建立日期', 'orderDate')}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                {hasFilter ? '找不到符合條件的訂單' : '尚無供應商訂單'}
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
                  <td className="px-4 py-3 text-gray-400">{o.orderDate ? formatDate(o.orderDate) : '-'}</td>
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
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
              const pp = new URLSearchParams()
              if (search) pp.set('search', search)
              if (sku) pp.set('sku', sku)
              if (statusFilter) pp.set('status', statusFilter)
              if (supplierId) pp.set('supplierId', String(supplierId))
              pp.set('sort', sort); pp.set('dir', dir); pp.set('page', String(p))
              return (
                <Link key={p} href={`/purchases?${pp.toString()}`}
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
