import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import InventoryControls from './InventoryControls'

type Props = { params: { productId: string } }

const MOVEMENT_TYPE: Record<number, { label: string; color: string }> = {
  1: { label: '進貨入庫', color: 'text-green-600' },
  2: { label: '銷售出庫', color: 'text-red-500' },
  3: { label: '手動調整', color: 'text-blue-500' },
  4: { label: '盤點調整', color: 'text-purple-500' },
}

export default async function InventoryDetailPage({ params }: Props) {
  const productId = Number(params.productId)

  const [stock, movements, product] = await Promise.all([
    prisma.iNV_Stock.findUnique({
      where: { productId },
    }),
    prisma.iNV_Movement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    prisma.pRD_Product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, sku: true, unit: true, isActive: true },
    }),
  ])

  if (!product || !product.isActive) notFound()

  const currentStock = stock?.quantity ?? 0
  const safetyStock = stock?.safetyStock ?? 0
  const isLow = currentStock <= safetyStock
  const isZero = currentStock === 0

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <a href="/inventory" className="text-sm text-gray-400 hover:text-gray-600">← 庫存管理</a>
        <h1 className="text-2xl font-bold text-gray-800 mt-1">{product.name}</h1>
        {product.sku && <p className="text-sm text-gray-400 font-mono">{product.sku}</p>}
      </div>

      {/* 庫存狀態卡片 */}
      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">現有庫存</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-5xl font-bold ${isZero ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-gray-900'}`}>
                {currentStock.toLocaleString()}
              </span>
              <span className="text-gray-400 text-lg">{product.unit ?? 'PCS'}</span>
            </div>
            {isZero && <p className="text-red-500 text-sm mt-1 font-medium">⚠ 庫存為零，需要緊急補貨</p>}
            {!isZero && isLow && <p className="text-yellow-600 text-sm mt-1">⚠ 低於安全庫存（{safetyStock}），建議補貨</p>}
            {!isLow && <p className="text-green-600 text-sm mt-1">✓ 庫存正常</p>}
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-500">安全庫存</p>
            <p className="text-2xl font-semibold text-gray-600">{safetyStock.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* 操作區（手動調整 + 安全庫存設定） */}
      <InventoryControls
        productId={params.productId}
        currentStock={currentStock}
        safetyStock={safetyStock}
        unit={product.unit ?? 'PCS'}
      />

      {/* 採購建議 */}
      {isLow && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-yellow-800">採購建議</p>
          <p className="text-sm text-yellow-700 mt-1">
            建議補貨 {Math.max(0, safetyStock * 2 - currentStock).toLocaleString()} {product.unit ?? 'PCS'} 以回到安全水位的 2 倍。
          </p>
          <a href="/purchases/new" className="inline-block mt-2 text-sm text-blue-600 hover:underline">
            → 建立採購單
          </a>
        </div>
      )}

      {/* 異動歷程 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-700">異動歷程</h2>
          <p className="text-xs text-gray-400 mt-0.5">最近 60 筆</p>
        </div>

        {movements.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">尚無異動紀錄</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">日期</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">類型</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">數量</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">異動後</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">備註</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {movements.map(m => {
                const t = MOVEMENT_TYPE[m.type] ?? { label: '其他', color: 'text-gray-500' }
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-400 text-xs">{formatDate(m.createdAt)}</td>
                    <td className="px-4 py-2">
                      <span className={`font-medium text-xs ${t.color}`}>{t.label}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className={m.quantity > 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">{m.balanceAfter.toLocaleString()}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs">
                      {m.patiscoOrderNo
                        ? <span className="text-blue-500 font-mono">Patisco: {m.patiscoOrderNo}</span>
                        : m.note ?? '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
