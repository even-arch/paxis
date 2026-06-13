import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import ProductsClient from './ProductsClient'

export const dynamic = 'force-dynamic'

const VALID_SORTS = ['name', 'sku', 'modelNo', 'unit', 'createdAt'] as const
type SortField = typeof VALID_SORTS[number]

type Props = {
  searchParams: {
    search?: string; page?: string; supplierId?: string; customerId?: string
    archived?: string; sort?: string; dir?: string
  }
}

export default async function ProductsPage({ searchParams }: Props) {
  const search = searchParams.search ?? ''
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const supplierId = searchParams.supplierId ? Number(searchParams.supplierId) : null
  const customerId = searchParams.customerId ? Number(searchParams.customerId) : null
  const archived = searchParams.archived === 'true'
  const sort: SortField = VALID_SORTS.includes(searchParams.sort as SortField) ? searchParams.sort as SortField : 'sku'
  const dir = searchParams.dir === 'desc' ? 'desc' : 'asc'
  const limit = 20

  const [filterSupplier, filterCustomer, suppliers, customers] = await Promise.all([
    supplierId ? prisma.sUP_Supplier.findUnique({ where: { id: supplierId }, select: { name: true } }) : null,
    customerId ? prisma.cUS_Customer.findUnique({ where: { id: customerId }, select: { name: true } }) : null,
    prisma.sUP_Supplier.findMany({ select: { id: true, name: true, shortName: true }, orderBy: { name: 'asc' } }),
    prisma.cUS_Customer.findMany({ select: { id: true, name: true, shortName: true }, orderBy: { name: 'asc' } }),
  ])

  const baseWhere: Record<string, unknown> = {
    isActive: true,
    isArchived: archived,
  }
  if (supplierId) baseWhere.supplierProducts = { some: { supplierId } }
  if (customerId) baseWhere.salesItems = { some: { order: { customerId } } }

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
      orderBy: { [sort]: dir },
      skip: (page - 1) * limit,
      take: limit,
      include: { inventoryItems: { select: { quantity: true } } },
    }),
  ])

  return (
    <ProductsClient
      sort={sort}
      dir={dir}
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
      customerId={customerId}
      archived={archived}
      filterSupplierName={filterSupplier?.name}
      filterCustomerName={filterCustomer?.name}
      suppliers={suppliers.map(s => ({ id: s.id, label: s.shortName ?? s.name }))}
      customers={customers.map(c => ({ id: c.id, label: c.shortName ?? c.name }))}
    />
  )
}
