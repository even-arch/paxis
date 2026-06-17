export const dynamic = 'force-dynamic'
import { getPagePrisma } from '@/lib/page-db'
import SalesImportWizard from '@/modules/sales/SalesImportWizard'
import Link from 'next/link'
import { orgPath } from '@/lib/org-path'

export default async function SalesImportPage({ params }: { params: { orgSlug: string } }) {
  const prisma = await getPagePrisma(params.orgSlug)
  const [customers, products] = await Promise.all([
    prisma.cUS_Customer.findMany({
      where: { isActive: true },
      select: { id: true, name: true, shortName: true, currencyCode: true, email: true, phoneNo: true, paymentTerms: true, city: true, countryCode: true, postalCode: true, taxId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.pRD_Product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sku: true, unit: true, specification: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href={orgPath(params.orgSlug, '/sales')} className="text-sm text-gray-400 hover:text-gray-600">← 客戶訂單</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">AI 匯入客戶訂單</h1>
          <p className="text-sm text-gray-500 mt-0.5">上傳客戶 PO 文件，AI 自動識別品項與客戶資訊</p>
        </div>
        <Link href={orgPath(params.orgSlug, '/sales/new')}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50">
          + 改用手動建立
        </Link>
      </div>
      <SalesImportWizard customers={customers} products={products} />
    </div>
  )
}
