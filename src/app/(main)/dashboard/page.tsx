export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'

export default async function DashboardPage() {
  const [productCount, supplierCount, lowStockCount] = await Promise.all([
    prisma.pRD_Product.count({ where: { isActive: true } }),
    prisma.sUP_Supplier.count({ where: { isActive: true } }),
    prisma.iNV_Stock.count({ where: { quantity: { lte: prisma.iNV_Stock.fields.safetyStock } } }),
  ]).catch(() => [0, 0, 0])

  const stats = [
    { label: '商品總數', value: productCount, href: '/products', color: 'bg-blue-500' },
    { label: '供應商數', value: supplierCount, href: '/suppliers', color: 'bg-green-500' },
    { label: '低庫存警示', value: lowStockCount, href: '/inventory', color: 'bg-red-500' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">總覽</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {stats.map(s => (
          <a
            key={s.label}
            href={s.href}
            className="bg-white rounded-lg shadow p-6 flex items-center gap-4 hover:shadow-md transition-shadow"
          >
            <div className={`${s.color} w-12 h-12 rounded-lg flex items-center justify-center`}>
              <span className="text-white text-xl font-bold">{s.value}</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className="text-2xl font-semibold text-gray-800">{s.value}</p>
            </div>
          </a>
        ))}
      </div>

      {/* AI 匯入單據 */}
      <a href="/import"
        className="block mb-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6 hover:border-purple-400 hover:shadow-md transition-all">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center text-2xl shrink-0">✨</div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800 text-base">AI 匯入單據</p>
            <p className="text-sm text-gray-500 mt-0.5">上傳採購單或形式發票（PI），AI 自動建立產品與供應商資料，再幫你預填採購單。</p>
          </div>
          <span className="text-gray-400 text-lg shrink-0">→</span>
        </div>
      </a>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">快速連結</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '新增商品', href: '/products/new' },
            { label: '新增供應商', href: '/suppliers/new' },
            { label: '建立採購單', href: '/purchases/new' },
            { label: '成本試算', href: '/cost/new' },
          ].map(link => (
            <a key={link.href} href={link.href}
              className="border border-gray-200 rounded-md px-4 py-3 text-sm text-center text-gray-600 hover:bg-gray-50 hover:text-blue-600">
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
