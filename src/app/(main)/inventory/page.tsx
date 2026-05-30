import { prisma } from '@/lib/db'

type Props = { searchParams: { search?: string; filter?: string } }

export default async function InventoryPage({ searchParams }: Props) {
  const search = searchParams.search ?? ''
  const filter = searchParams.filter ?? ''

  // 先取商品，再取庫存
  const products = await prisma.pRD_Product.findMany({
    where: search
      ? { isActive: true, OR: [{ name: { contains: search } }, { sku: { contains: search } }] }
      : { isActive: true },
    select: { id: true, name: true, sku: true, unit: true },
    orderBy: { name: 'asc' },
  })

  const stocks = await prisma.iNV_Stock.findMany({
    where: { productId: { in: products.map(p => p.id) } },
  })

  const stockMap = new Map(stocks.map(s => [s.productId, s]))

  type Row = {
    product: typeof products[0]
    quantity: number
    safetyStock: number
    stockId: number | null
  }

  let rows: Row[] = products.map(p => {
    const s = stockMap.get(p.id)
    const qty = s?.quantity ?? 0
    const reserved = s?.reservedQty ?? 0
    return { product: p, quantity: qty - reserved, safetyStock: s?.safetyStock ?? 0, stockId: s?.id ?? null }
  })

  const lowRows = rows.filter(r => r.quantity <= r.safetyStock)
  if (filter === 'low') rows = lowRows

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">庫存管理</h1>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
          <div className="bg-blue-500 w-10 h-10 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">{products.length}</span>
          </div>
          <div><p className="text-xs text-gray-500">商品總數</p><p className="text-2xl font-semibold text-gray-800">{products.length}</p></div>
        </div>
        <a href={filter !== 'low' ? '?filter=low' : '?'}
          className="bg-white rounded-lg shadow p-5 flex items-center gap-4 hover:shadow-md">
          <div className={`${lowRows.length > 0 ? 'bg-red-500' : 'bg-green-500'} w-10 h-10 rounded-lg flex items-center justify-center`}>
            <span className="text-white text-sm font-bold">{lowRows.length}</span>
          </div>
          <div><p className="text-xs text-gray-500">低庫存警示</p><p className="text-2xl font-semibold text-gray-800">{lowRows.length}</p></div>
        </a>
        <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
          <div className="bg-gray-500 w-10 h-10 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">%</span>
          </div>
          <div>
            <p className="text-xs text-gray-500">安全庫存設定</p>
            <p className="text-lg font-semibold text-gray-800">{rows.filter(r => r.safetyStock > 0).length} / {products.length}</p>
          </div>
        </div>
      </div>

      {/* 搜尋 */}
      <form method="GET" className="mb-4 flex gap-2">
        <input name="search" defaultValue={search}
          placeholder="搜尋商品名稱、SKU..."
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {filter === 'low' && <input type="hidden" name="filter" value="low" />}
        <button type="submit" className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-200">搜尋</button>
        {(search || filter) && (
          <a href="/inventory" className="border border-gray-300 px-4 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-50">清除</a>
        )}
        {filter !== 'low' && lowRows.length > 0 && (
          <a href="?filter=low" className="border border-red-300 text-red-600 px-4 py-2 rounded-md text-sm hover:bg-red-50">
            只看低庫存 ({lowRows.length})
          </a>
        )}
      </form>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">商品</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">現有庫存</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">安全庫存</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">狀態</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                {filter === 'low' ? '目前沒有低庫存商品 👍' : search ? `找不到「${search}」` : '尚無庫存資料'}
              </td></tr>
            )}
            {rows.map(({ product, quantity, safetyStock }) => {
              const isLow = quantity <= safetyStock
              const isZero = quantity === 0
              return (
                <tr key={product.id} className={`hover:bg-gray-50 ${isZero ? 'bg-red-50' : isLow ? 'bg-yellow-50' : ''}`}>
                  <td className="px-4 py-3">
                    <a href={`/inventory/${product.id}`} className="font-medium text-blue-600 hover:underline">
                      {product.name}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{product.sku ?? '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold text-base ${isZero ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-gray-800'}`}>
                      {quantity.toLocaleString()}
                    </span>
                    <span className="text-gray-400 text-xs ml-1">{product.unit ?? ''}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{safetyStock.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    {isZero
                      ? <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">無庫存</span>
                      : isLow
                      ? <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">低庫存</span>
                      : <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">正常</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/inventory/${product.id}`} className="text-gray-400 hover:text-blue-600 text-xs">詳情</a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
