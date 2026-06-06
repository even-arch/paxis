export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { prisma } from '@/lib/db'

type Props = { searchParams: { search?: string; filter?: string } }

export default async function InventoryPage({
  searchParams }: Props) {
    const search = searchParams.search ?? ''
  const filter = searchParams.filter ?? ''

  const products = await prisma.pRD_Product.findMany({
    where: search
      ? { isActive: true, OR: [{ name: { contains: search } }, { sku: { contains: search } }] }
      : { isActive: true },
    select: { id: true, name: true, sku: true, unit: true, safetyStock: true },
    orderBy: { name: 'asc' },
  })

  const stocks = await prisma.iNV_Stock.findMany({
    where: { productId: { in: products.map(p => p.id) } },
  })

  // 待入庫數量（供應商訂單已送出但未完全入庫的品項）
  const pendingItems = await prisma.pO_Item.findMany({
    where: {
      productId: { in: products.map(p => p.id) },
      order: { status: { in: [1, 2] } }, // 已送出 or 部分到貨
    },
    select: { productId: true, quantity: true, receivedQty: true },
  })

  const pendingMap = new Map<number, number>()
  for (const item of pendingItems) {
    const pending = item.quantity - item.receivedQty
    if (pending > 0) {
      pendingMap.set(item.productId, (pendingMap.get(item.productId) ?? 0) + pending)
    }
  }

  const stockMap = new Map(stocks.map(s => [s.productId, s]))

  type Row = {
    id: number; name: string; sku: string | null; unit: string | null
    quantity: number; reservedQty: number; availableQty: number
    safetyStock: number; pendingQty: number
    avgUnitCost: string | null
  }

  let rows: Row[] = products.map(p => {
    const s = stockMap.get(p.id)
    const quantity = s?.quantity ?? 0
    const reservedQty = s?.reservedQty ?? 0
    const availableQty = quantity - reservedQty
    return {
      id: p.id, name: p.name, sku: p.sku, unit: p.unit,
      quantity, reservedQty, availableQty,
      safetyStock: s?.safetyStock ?? p.safetyStock ?? 0,
      pendingQty: pendingMap.get(p.id) ?? 0,
      avgUnitCost: s?.avgUnitCost ? s.avgUnitCost.toString() : null,
    }
  })

  const lowRows = rows.filter(r => r.availableQty <= r.safetyStock)
  if (filter === 'low') rows = lowRows

  const totalProducts = products.length
  const withStockCount = rows.filter(r => r.quantity > 0).length
  const reservedCount = rows.filter(r => r.reservedQty > 0).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">庫存管理</h1>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-gray-500 mb-1">商品總數</p>
          <p className="text-2xl font-semibold text-gray-800">{totalProducts}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-gray-500 mb-1">有庫存商品</p>
          <p className="text-2xl font-semibold text-blue-600">{withStockCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-gray-500 mb-1">有預留庫存</p>
          <p className="text-2xl font-semibold text-purple-600">{reservedCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">已發 PI 尚未出貨</p>
        </div>
        <Link href={filter !== 'low' ? '?filter=low' : '/inventory'}
          className={`bg-white rounded-lg shadow p-5 hover:shadow-md ${lowRows.length > 0 ? 'border-l-4 border-red-400' : ''}`}>
          <p className="text-xs text-gray-500 mb-1">低庫存警示</p>
          <p className={`text-2xl font-semibold ${lowRows.length > 0 ? 'text-red-600' : 'text-green-600'}`}>{lowRows.length}</p>
          {filter === 'low' && <p className="text-xs text-blue-500 mt-0.5">點擊顯示全部</p>}
        </Link>
      </div>

      <form method="GET" className="mb-4 flex gap-2">
        <input name="search" defaultValue={search}
          placeholder="搜尋商品名稱、SKU..."
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {filter === 'low' && <input type="hidden" name="filter" value="low" />}
        <button type="submit" className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-200">搜尋</button>
        {(search || filter) && (
          <Link href="/inventory" className="border border-gray-300 px-4 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-50">清除</Link>
        )}
        {filter !== 'low' && lowRows.length > 0 && (
          <Link href="?filter=low" className="border border-red-300 text-red-600 px-4 py-2 rounded-md text-sm hover:bg-red-50">
            只看低庫存 ({lowRows.length})
          </Link>
        )}
      </form>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">商品</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">
                <span className="text-blue-600">可用庫存</span>
                <span className="text-gray-400 text-xs ml-1 font-normal">= 實際 − 預留</span>
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">實際庫存</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 text-purple-600">預留中</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 text-teal-600">採購在途</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">安全庫存</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">加權成本</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">狀態</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                {filter === 'low' ? '目前沒有低庫存商品 👍' : search ? `找不到「${search}」` : '尚無庫存資料'}
              </td></tr>
            )}
            {rows.map(row => {
              const isLow = row.availableQty <= row.safetyStock && row.safetyStock > 0
              const isZero = row.availableQty <= 0
              return (
                <tr key={row.id} className={`hover:bg-gray-50 ${isZero ? 'bg-red-50' : isLow ? 'bg-yellow-50' : ''}`}>
                  <td className="px-4 py-3">
                    <Link href={`/inventory/${row.id}`} className="font-medium text-blue-600 hover:underline">
                      {row.name}
                    </Link>
                    {row.sku && <span className="ml-1.5 text-xs text-gray-400 font-mono">{row.sku}</span>}
                  </td>
                  {/* 可用庫存（主要數字）*/}
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold text-base ${isZero ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-blue-700'}`}>
                      {row.availableQty.toLocaleString()}
                    </span>
                    <span className="text-gray-400 text-xs ml-1">{row.unit ?? ''}</span>
                  </td>
                  {/* 實際庫存 */}
                  <td className="px-4 py-3 text-right text-gray-600">
                    {row.quantity.toLocaleString()}
                  </td>
                  {/* 預留中（PI 已發） */}
                  <td className="px-4 py-3 text-right">
                    {row.reservedQty > 0
                      ? <span className="text-purple-600 font-medium">{row.reservedQty.toLocaleString()}</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  {/* 採購在途 */}
                  <td className="px-4 py-3 text-right">
                    {row.pendingQty > 0
                      ? <span className="text-teal-600 font-medium">+{row.pendingQty.toLocaleString()}</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  {/* 安全庫存 */}
                  <td className="px-4 py-3 text-right text-gray-500">
                    {row.safetyStock > 0 ? row.safetyStock.toLocaleString() : <span className="text-gray-300">—</span>}
                  </td>
                  {/* 加權成本 */}
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    {row.avgUnitCost ? `TWD ${parseFloat(row.avgUnitCost).toFixed(2)}` : <span className="text-gray-300">—</span>}
                  </td>
                  {/* 狀態 */}
                  <td className="px-4 py-3 text-center">
                    {isZero
                      ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">無庫存</span>
                      : isLow
                      ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">低庫存</span>
                      : <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">正常</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/inventory/${row.id}`} className="text-gray-400 hover:text-blue-600 text-xs">異動記錄</Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 欄位說明 */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-400">
        <span><span className="text-blue-600 font-medium">可用庫存</span> = 實際庫存 − 預留中（供防超賣判斷）</span>
        <span><span className="text-purple-600 font-medium">預留中</span> = 已發 PI 正本、貨尚未出倉</span>
        <span><span className="text-teal-600 font-medium">採購在途</span> = 供應商訂單已送出、貨尚未到倉</span>
      </div>
    </div>
  )
}
