import { prisma } from '@/lib/db'
import dynamic from 'next/dynamic'

// ssr: false 避免 useState('choose') 在 SSR 產生 hydration mismatch
const PurchaseForm = dynamic(() => import('./PurchaseForm'), { ssr: false })

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
      <h1 className="text-2xl font-bold text-gray-800 mb-6">新增採購單</h1>
      <PurchaseForm suppliers={suppliers} products={products} />
    </div>
  )
}
