import { getPagePrisma } from '@/lib/page-db'
import { orgPath } from '@/lib/org-path'
import PurchaseForm from './PurchaseForm'

export default async function NewPurchasePage({ params }: { params: { orgSlug: string } }) {
  const prisma = await getPagePrisma(params.orgSlug)
  const [suppliers, products, openSalesOrders] = await Promise.all([
    prisma.sUP_Supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true, shortName: true, currencyCode: true },
      orderBy: { name: 'asc' },
    }),
    prisma.pRD_Product.findMany({
      where: { isActive: true, isArchived: false },
      select: { id: true, name: true, sku: true, unit: true, specification: true },
      orderBy: [{ sku: 'asc' }, { name: 'asc' }],
    }),
    // 進行中的客戶訂單（排除已完成/取消），供接單後採購選擇
    prisma.sLS_Order.findMany({
      where: { status: { in: [0, 1, 2, 3] } },
      select: {
        id: true,
        orderNo: true,
        patiscoBuyerName: true,
        customer: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <a href={orgPath(params.orgSlug, '/purchases')} className="text-sm text-gray-400 hover:text-gray-600">← 採購訂單</a>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">手動建立採購訂單</h1>
        </div>
        <a href={orgPath(params.orgSlug, '/purchases/import')}
          className="border border-indigo-400 text-indigo-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-50">
          ✨ 改用 AI 匯入
        </a>
      </div>
      <PurchaseForm suppliers={suppliers} products={products} salesOrders={openSalesOrders} />
    </div>
  )
}
