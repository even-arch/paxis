import { prisma } from '@/lib/db'
import dynamic from 'next/dynamic'

const ImportWizard = dynamic(() => import('./ImportWizard'), { ssr: false })

export default async function ImportPage() {
  const [suppliers, products] = await Promise.all([
    prisma.sUP_Supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true, shortName: true, currencyCode: true, email: true, phoneNo: true, address: true, city: true, countryCode: true, paymentTerms: true },
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
      <div className="mb-6">
        <a href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">← 返回總覽</a>
        <h1 className="text-2xl font-bold text-gray-800 mt-1">AI 匯入單據</h1>
        <p className="text-sm text-gray-500 mt-1">上傳採購單或形式發票，系統自動建立產品、供應商，再幫你預填採購單。</p>
      </div>
      <ImportWizard suppliers={suppliers} products={products} />
    </div>
  )
}
