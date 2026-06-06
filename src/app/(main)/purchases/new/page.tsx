import { prisma } from '@/lib/db'
import PurchaseForm from './PurchaseForm'

export default async function NewPurchasePage() {
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
    // 進行中的銷售訂單（排除已完成/取消），供接單後採購選擇
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
        <h1 className="text-2xl font-bold text-gray-800">新增採購單</h1>
        <a href="/import" className="text-sm text-purple-600 hover:text-purple-800">
          ✨ 改用 AI 匯入單據
        </a>
      </div>
      <PurchaseForm suppliers={suppliers} products={products} salesOrders={openSalesOrders} />
    </div>
  )
}
