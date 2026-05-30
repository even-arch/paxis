import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'

type Props = { searchParams: { search?: string; page?: string } }

export default async function ProductsPage({ searchParams }: Props) {
  const search = searchParams.search ?? ''
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const limit = 20

  const where = search
    ? {
        isActive: true,
        OR: [
          { name: { contains: search } },
          { sku: { contains: search } },
          { modelNo: { contains: search } },
        ],
      }
    : { isActive: true }

  const [total, products] = await Promise.all([
    prisma.pRD_Product.count({ where }),
    prisma.pRD_Product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { inventoryItems: { select: { quantity: true } } },
    }),
  ])

  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">商品管理</h1>
        <Link
          href="/products/import"
          className="border border-purple-300 text-purple-700 bg-purple-50 px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-100"
        >
          ✨ AI 匯入
        </Link>
        <Link
          href="/products/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          + 新增商品
        </Link>
      </div>

      {/* 搜尋列 */}
      <form method="GET" className="mb-4 flex gap-2">
        <input
          name="search"
          defaultValue={search}
          placeholder="搜尋商品名稱、SKU、型號..."
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-200">
          搜尋
        </button>
        {search && (
          <Link href="/products" className="border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50 text-gray-500">
            清除
          </Link>
        )}
      </form>

      {/* 表格 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">商品名稱</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">型號</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">單位</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">庫存</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">建立日期</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  {search ? `找不到「${search}」相關商品` : '尚無商品，請新增'}
                </td>
              </tr>
            )}
            {products.map((p: typeof products[0]) => (
              <tr key={p.id.toString()} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/products/${p.id}`} className="font-medium text-blue-600 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{p.sku ?? '-'}</td>
                <td className="px-4 py-3 text-gray-500">{p.modelNo ?? '-'}</td>
                <td className="px-4 py-3 text-gray-500">{p.unit ?? '-'}</td>
                <td className="px-4 py-3 text-right">
                  {p.inventoryItems[0]?.quantity ?? 0}
                </td>
                <td className="px-4 py-3 text-gray-400">{formatDate(p.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/products/${p.id}/edit`} className="text-gray-400 hover:text-blue-600 text-xs">
                    編輯
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分頁 */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm">
          <span className="text-gray-500">共 {total} 筆</span>
          <div className="flex gap-1 ml-auto">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <Link
                key={p}
                href={`/products?search=${search}&page=${p}`}
                className={`px-3 py-1 rounded-md ${p === page ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                {p}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
