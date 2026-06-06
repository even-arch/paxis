export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import SalesOrderForm from '@/modules/sales/SalesOrderForm'

export default async function SalesNewPage() {
    const [customers, products] = await Promise.all([
    prisma.cUS_Customer.findMany({
      where: { isActive: true },
      select: { id: true, name: true, shortName: true, currencyCode: true },
      orderBy: { name: 'asc' },
    }),
    prisma.pRD_Product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sku: true, unit: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/sales" className="text-sm text-gray-400 hover:text-gray-600">← 銷售訂單</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">手動建立銷售訂單</h1>
        </div>
        <Link href="/sales/import"
          className="border border-teal-400 text-teal-700 px-4 py-2 rounded-md text-sm hover:bg-teal-50">
          改用 AI 匯入
        </Link>
      </div>
      <SalesOrderForm customers={customers} products={products} />
    </div>
  )
}
