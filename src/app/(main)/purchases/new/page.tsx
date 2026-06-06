import { prisma } from '@/lib/db'
import PurchaseForm from './PurchaseForm'

export default async function NewPurchasePage() {
    const [suppliers, products] = await Promise.all([
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
  ])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">新增採購單</h1>
        <a href="/import" className="text-sm text-purple-600 hover:text-purple-800">
          ✨ 改用 AI 匯入單據
        </a>
      </div>
      <PurchaseForm suppliers={suppliers} products={products} />
    </div>
  )
}
