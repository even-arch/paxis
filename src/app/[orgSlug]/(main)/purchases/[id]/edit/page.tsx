import { notFound } from 'next/navigation'
import { getPagePrisma } from '@/lib/page-db'
import PurchaseEditForm from './PurchaseEditForm'

type Props = { params: { orgSlug: string; id: string } }

export default async function EditPurchasePage({
  params }: Props) {
  const prisma = await getPagePrisma(params.orgSlug)
  const [order, suppliers] = await Promise.all([
    prisma.pO_Order.findUnique({
      where: { id: Number(params.id) },
      include: { items: { include: { product: true } } },
    }),
    prisma.sUP_Supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true, shortName: true, currencyCode: true },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!order || order.status !== 0) notFound()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">編輯供應商訂單</h1>
      <PurchaseEditForm order={order} suppliers={suppliers} />
    </div>
  )
}
