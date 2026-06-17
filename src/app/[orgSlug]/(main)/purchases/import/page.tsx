import { getPagePrisma } from '@/lib/page-db'
import { orgPath } from '@/lib/org-path'
import dynamic from 'next/dynamic'

const ImportWizard = dynamic(() => import('./ImportWizard'), { ssr: false })

export default async function PurchaseImportPage({ params }: { params: { orgSlug: string } }) {
  const prisma = await getPagePrisma(params.orgSlug)
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <a href={orgPath(params.orgSlug, '/purchases')} className="text-sm text-gray-400 hover:text-gray-600">← 採購訂單</a>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">AI 匯入採購單</h1>
          <p className="text-sm text-gray-500 mt-0.5">上傳供應商訂單或形式發票，系統自動建立產品、供應商，再幫你預填採購訂單。</p>
        </div>
        <a href={orgPath(params.orgSlug, '/purchases/new')}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50">
          + 改用手動建立
        </a>
      </div>
      <ImportWizard suppliers={suppliers} products={products} />
    </div>
  )
}
