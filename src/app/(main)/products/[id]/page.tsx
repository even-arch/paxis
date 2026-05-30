import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import DeleteProductButton from './DeleteProductButton'

type Props = { params: { id: string } }

export default async function ProductDetailPage({ params }: Props) {
  const product = await prisma.pRD_Product.findUnique({
    where: { id: Number(params.id) },
    include: {
      inventoryItems: true,
      supplierProducts: {
        include: { supplier: { select: { id: true, name: true, shortName: true } } },
      },
    },
  })

  if (!product || !product.isActive) notFound()

  const stock = product.inventoryItems[0]

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/products" className="text-sm text-gray-400 hover:text-gray-600">← 商品列表</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">{product.name}</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/products/${params.id}/edit`} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
            編輯
          </Link>
          <DeleteProductButton productId={params.id} />
        </div>
      </div>

      <div className="space-y-4">
        {/* 基本資料 */}
        <Card title="基本資料">
          <Row label="商品名稱" value={product.name} />
          <Row label="SKU / 料號" value={product.sku} />
          <Row label="型號" value={product.modelNo} />
          <Row label="單位" value={product.unit} />
          <Row label="原產地" value={product.countryOfOrigin} />
          <Row label="描述" value={product.description} />
          <Row label="規格" value={product.specification} />
        </Card>

        {/* 包裝規格 */}
        <Card title="包裝規格">
          <div className="grid grid-cols-2 gap-x-8">
            <Row label="每內箱數量" value={product.unitPerInner?.toString()} />
            <Row label="每外箱數量" value={product.unitPerCarton?.toString()} />
            <Row label="CBM" value={product.cbm?.toString()} />
            <Row label="毛重 (KGS)" value={product.grossWeight?.toString()} />
            <Row label="淨重 (KGS)" value={product.netWeight?.toString()} />
            <Row label="尺寸 (CM)" value={
              product.length && product.width && product.height
                ? `${product.length} × ${product.width} × ${product.height}`
                : undefined
            } />
          </div>
        </Card>

        {/* 貿易資訊 */}
        <Card title="貿易資訊">
          <Row label="HTS Code" value={product.htsCode} />
        </Card>

        {/* 庫存 */}
        <Card title="庫存狀況">
          <Row label="現有庫存" value={stock ? `${stock.quantity} ${product.unit ?? ''}` : '0'} />
          <Row label="安全庫存" value={stock ? `${stock.safetyStock} ${product.unit ?? ''}` : '-'} />
        </Card>

        {/* 供應商 */}
        {product.supplierProducts.length > 0 && (
          <Card title="供應商">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-1">供應商</th>
                  <th className="py-1">供應商料號</th>
                  <th className="py-1">單價</th>
                  <th className="py-1">MOQ</th>
                  <th className="py-1">主要</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {product.supplierProducts.map((sp: typeof product.supplierProducts[0]) => (
                  <tr key={sp.id.toString()}>
                    <td className="py-2">
                      <Link href={`/suppliers/${sp.supplier.id}`} className="text-blue-600 hover:underline">
                        {sp.supplier.shortName ?? sp.supplier.name}
                      </Link>
                    </td>
                    <td className="py-2 text-gray-500">{sp.supplierSku ?? '-'}</td>
                    <td className="py-2">{sp.unitPrice ? `${sp.currencyCode} ${sp.unitPrice}` : '-'}</td>
                    <td className="py-2 text-gray-500">{sp.moq ?? '-'}</td>
                    <td className="py-2">{sp.isPreferred ? '✓' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        <p className="text-xs text-gray-400">建立時間：{formatDate(product.createdAt)}</p>
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
