import { prisma } from '@/lib/db'
import CostForm from '@/modules/cost/CostForm'

export default async function NewCostPage() {
  const products = await prisma.pRD_Product.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, sku: true, modelNo: true, unit: true,
      unitPerInner: true, unitPerCarton: true, cbm: true,
      grossWeight: true, netWeight: true, htsCode: true, countryOfOrigin: true,
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">新增成本試算表</h1>
      <CostForm products={products} />
    </div>
  )
}
