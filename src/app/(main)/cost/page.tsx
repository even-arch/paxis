import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'

type Props = { searchParams: { search?: string; page?: string } }

export default async function CostPage({ searchParams }: Props) {
  const search = searchParams.search ?? ''
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const limit = 20

  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { product: { name: { contains: search } } },
          { product: { sku: { contains: search } } },
        ],
      }
    : {}

  const [total, sheets] = await Promise.all([
    prisma.cOST_Sheet.count({ where }),
    prisma.cOST_Sheet.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        creator: { select: { name: true } },
      },
    }),
  ])

  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">成本計算</h1>
        <a href="/cost/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          + 新增試算表
        </a>
      </div>

      <form method="GET" className="mb-4 flex gap-2">
        <input name="search" defaultValue={search}
          placeholder="搜尋試算表名稱、商品..."
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-200">搜尋</button>
        {search && <a href="/cost" className="border border-gray-300 px-4 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-50">清除</a>}
      </form>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">試算表名稱</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">商品</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">FOB</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Landed Cost</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">售價</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">毛利率</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">更新時間</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sheets.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                {search ? `找不到「${search}」` : '尚無試算表，請新增'}
              </td></tr>
            )}
            {sheets.map((s: typeof sheets[0]) => {
              const grossPct = s.grossMarginPct ? parseFloat(s.grossMarginPct.toString()) * 100 : null
              const grossColor = grossPct === null ? 'text-gray-400'
                : grossPct < 0 ? 'text-red-600 font-bold'
                : grossPct < 20 ? 'text-yellow-600 font-medium'
                : 'text-green-600 font-medium'
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <a href={`/cost/${s.id}`} className="font-medium text-blue-600 hover:underline">{s.name}</a>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.product.name}
                    {s.product.sku && <span className="text-gray-400 text-xs ml-1">({s.product.sku})</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 font-mono text-xs">
                    {s.fobCurrency} {parseFloat(s.fobPrice.toString()).toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {s.landedCost ? `USD ${parseFloat(s.landedCost.toString()).toFixed(4)}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {s.sellingPrice ? `USD ${parseFloat(s.sellingPrice.toString()).toFixed(2)}` : '-'}
                  </td>
                  <td className={`px-4 py-3 text-center text-sm ${grossColor}`}>
                    {grossPct !== null ? `${grossPct.toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(s.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/cost/${s.id}/edit`} className="text-gray-400 hover:text-blue-600 text-xs">編輯</a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex gap-1 mt-4 ml-auto w-fit">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <a key={p} href={`/cost?search=${search}&page=${p}`}
              className={`px-3 py-1 rounded-md text-sm ${p === page ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
