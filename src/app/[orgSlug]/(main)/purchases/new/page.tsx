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
    // 有效的我方 PI（供接單後採購連結用）
    prisma.sLS_PI.findMany({
      where: { status: { in: [0, 2] } },  // 有效或已出貨
      select: {
        id: true,
        piNo: true,
        totalAmount: true,
        currencyCode: true,
        customer: { select: { name: true, shortName: true } },
        order: { select: { id: true, orderNo: true } },
      },
      orderBy: { performedAt: 'desc' },
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
      <PurchaseForm suppliers={suppliers} products={products} slsPIs={openSalesOrders} />
    </div>
  )
}
