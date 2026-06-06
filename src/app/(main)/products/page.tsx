import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import ProductsClient from './ProductsClient'

export const dynamic = 'force-dynamic'

type Props = { searchParams: { search?: string; page?: string; supplierId?: string; archived?: string } }

export default async function ProductsPage({
  searchParams }: Props) {
    const search = searchParams.search ?? ''
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const supplierId = searchParams.supplierId ? Number(searchParams.supplierId) : null
  const archived = searchParams.archived === 'true'
  const limit = 20

  const filterSupplier = supplierId
    ? await prisma.sUP_Supplier.findUnique({ where: { id: supplierId }, select: { name: true } })
    : null

  const baseWhere = {
    isActive: true,
    isArchived: archived,
    ...(supplierId ? { supplierProducts: { some: { supplierId } } } : {}),
  }

  const where = search
    ? {
        ...baseWhere,
        OR: [
          { name: { contains: search } },
          { sku: { contains: search } },
          { modelNo: { contains: search } },
        ],
      }
    : baseWhere

  const [total, products] = await Promise.all([
    prisma.pRD_Product.count({ where }),
    prisma.pRD_Product.findMany({
      where,
      orderBy: [{ sku: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: { inventoryItems: { select: { quantity: true } } },
    }),
  ])

  return (
    <ProductsClient
      products={products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        modelNo: p.modelNo,
        unit: p.unit,
        isArchived: p.isArchived,
        stock: p.inventoryItems[0]?.quantity ?? 0,
        createdAt: formatDate(p.createdAt),
      }))}
      total={total}
      page={page}
      totalPages={Math.ceil(total / limit)}
      search={search}
      supplierId={supplierId}
      archived={archived}
      filterSupplierName={filterSupplier?.name}
    />
  )
}
