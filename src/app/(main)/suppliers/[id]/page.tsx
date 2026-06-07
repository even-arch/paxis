import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import DeleteSupplierButton from './DeleteSupplierButton'
import SupplierProductPanel from './SupplierProductPanel'

type Props = { params: { id: string } }

export default async function SupplierDetailPage({
  params }: Props) {
    const [supplier, recentOrders, allProducts] = await Promise.all([
    prisma.sUP_Supplier.findUnique({
      where: { id: Number(params.id) },
      include: {
        contacts: true,
        products: {
          include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
          orderBy: { isPreferred: 'desc' },
        },
      },
    }),
    prisma.pO_Order.findMany({
      where: { supplierId: Number(params.id) },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        _count: { select: { items: true } },
        receipts: { select: { id: true } },
      },
    }),
    prisma.pRD_Product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sku: true },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!supplier || !supplier.isActive) notFound()

  const STATUS_LABELS: Record<number, { label: string; color: string }> = {
    0: { label: '草稿',   color: 'bg-gray-100 text-gray-500' },
    1: { label: '已送出', color: 'bg-blue-100 text-blue-700' },
    2: { label: '部分入庫', color: 'bg-amber-100 text-amber-700' },
    3: { label: '完成',   color: 'bg-green-100 text-green-700' },
    4: { label: '取消',   color: 'bg-red-100 text-red-500' },
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/suppliers" className="text-sm text-gray-400 hover:text-gray-600">← 供應商</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">{supplier.name}</h1>
          {supplier.shortName && <p className="text-sm text-gray-500">{supplier.shortName}</p>}
        </div>
        <div className="flex gap-2">
          <Link href={`/suppliers/${params.id}/edit`}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
            編輯
          </Link>
          <DeleteSupplierButton supplierId={params.id} />
        </div>
      </div>

      <div className="space-y-4">
        <Card title="基本資料">
          <Row label="供應商名稱" value={supplier.name} />
          <Row label="簡稱" value={supplier.shortName} />
          <Row label="慣用幣別" value={supplier.currencyCode} />
          <Row label="付款條件" value={supplier.paymentTerms} />
          <Row label="統一編號" value={supplier.taxId} />
        </Card>

        <Card title="聯絡資訊">
          <Row label="主要聯絡人" value={supplier.contactPerson} />
          <Row label="Email" value={supplier.email} />
          <Row label="電話" value={supplier.phoneNo} />
          <Row label="傳真" value={supplier.fax} />
        </Card>

        <Card title="地址">
          <Row label="地址" value={supplier.address} />
          <Row label="城市" value={supplier.city} />
          <Row label="國家" value={supplier.countryCode} />
          <Row label="郵遞區號" value={supplier.postalCode} />
        </Card>

        {supplier.note && (
          <Card title="備註">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{supplier.note}</p>
          </Card>
        )}

        {/* 供應商訂單歷史 */}
        <Card title={`供應商訂單記錄（${recentOrders.length} 筆）`}>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-gray-400">尚無供應商訂單</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="text-left py-2 font-medium">單號</th>
                  <th className="text-left py-2 font-medium">品項數</th>
                  <th className="text-left py-2 font-medium">幣別</th>
                  <th className="text-left py-2 font-medium">狀態</th>
                  <th className="text-left py-2 font-medium">建立日期</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentOrders.map(o => {
                  const badge = STATUS_LABELS[o.status] ?? STATUS_LABELS[0]
                  return (
                    <tr key={o.id}>
                      <td className="py-2">
                        <Link href={`/purchases/${o.id}`} className="font-mono text-blue-600 hover:underline">
                          {o.poNo}
                        </Link>
                      </td>
                      <td className="py-2 text-gray-600">{o._count.items}</td>
                      <td className="py-2 text-gray-600">{o.currencyCode}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>{badge.label}</span>
                      </td>
                      <td className="py-2 text-gray-500">{formatDate(o.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {recentOrders.length >= 20 && (
            <Link href={`/purchases?supplierId=${params.id}`} className="text-xs text-blue-600 hover:underline mt-2 block">
              查看全部 →
            </Link>
          )}
        </Card>

        {/* 供應商商品對應 */}
        <div className="flex items-center justify-end mb-1">
          <Link href={`/products?supplierId=${params.id}`}
            className="text-xs text-blue-600 hover:underline">
            在商品管理中查看此供應商所有產品 →
          </Link>
        </div>
        <SupplierProductPanel
          supplierId={params.id}
          supplierProducts={supplier.products}
          allProducts={allProducts}
        />

        <p className="text-xs text-gray-400">建立時間：{formatDate(supplier.createdAt)}</p>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-base font-semibold text-gray-700 mb-3">{title}</h2>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex py-1.5 text-sm border-b border-gray-50 last:border-0">
      <span className="w-32 text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-800">{value || '-'}</span>
    </div>
  )
}
