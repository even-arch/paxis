export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import DeliveryNoteForm from './DeliveryNoteForm'

export default async function NewDeliveryNotePage() {
  const [customers, products] = await Promise.all([
    prisma.cUS_Customer.findMany({
      where: { isActive: true },
      select: { id: true, name: true, shortName: true, contactPerson: true, phoneNo: true, address: true, city: true, shippingMarkTemplate: true },
      orderBy: { name: 'asc' },
    }),
    prisma.pRD_Product.findMany({
      where: { isActive: true, isArchived: false },
      select: { id: true, sku: true, name: true, unit: true },
      orderBy: { sku: 'asc' },
    }),
  ])

  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const todayCount = await prisma.sLS_DeliveryNote.count({
    where: { docNo: { startsWith: `DN-${dateStr}-` } },
  })
  const nextDocNo = `DN-${dateStr}-${String(todayCount + 1).padStart(3, '0')}`

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/delivery-notes" className="text-gray-400 hover:text-gray-600 text-sm">← 出貨單列表</a>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-800">新增簡易出貨單</h1>
      </div>
      <DeliveryNoteForm nextDocNo={nextDocNo} customers={customers} products={products} />
    </div>
  )
}
