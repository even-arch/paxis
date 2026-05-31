import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import DeleteSupplierButton from './DeleteSupplierButton'
import SupplierProductPanel from './SupplierProductPanel'

type Props = { params: { id: string } }

export default async function SupplierDetailPage({ params }: Props) {
  const supplier = await prisma.sUP_Supplier.findUnique({
    where: { id: Number(params.id) },
    include: {
      contacts: true,
      products: {
        include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
        orderBy: { isPreferred: 'desc' },
      },
    },
  })

  if (!supplier || !supplier.isActive) notFound()

  // 取得所有商品供新增對應用
  const allProducts = await prisma.pRD_Product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, sku: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/suppliers" className="text-sm text-gray-400 hover:text-gray-600">← 供應商列表</Link>
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
