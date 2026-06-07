import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import DeleteProductButton from './DeleteProductButton'

type Props = { params: { id: string } }

export default async function ProductDetailPage({
  params }: Props) {
    const product = await prisma.pRD_Product.findUnique({
    where: { id: Number(params.id) },
    include: {
      inventoryItems: true,
      supplierProducts: {
        include: { supplier: { select: { id: true, name: true, shortName: true } } },
      },
      history: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { changer: { select: { name: true } } },
      },
    },
  })

  if (!product || !product.isActive) notFound()

  const stock = product.inventoryItems[0]

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/products" className="text-sm text-gray-400 hover:text-gray-600">← 商品管理</Link>
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

        {/* 庫存設定 */}
        <Card title="庫存設定">
          <Row label="接單後採購" value={product.isMadeToOrder ? '是（Made to Order）' : '否（有現貨）'} />
          <Row label="安全庫存量" value={`${product.safetyStock} ${product.unit ?? ''}`} />
        </Card>

        {/* 庫存狀況 */}
        <Card title="庫存狀況">
          <Row label="實際庫存" value={stock ? `${stock.quantity} ${product.unit ?? ''}` : '0'} />
          <Row label="預留量" value={stock ? `${stock.reservedQty} ${product.unit ?? ''}` : '0'} />
          <Row label="可用庫存" value={stock ? `${stock.quantity - stock.reservedQty} ${product.unit ?? ''}` : '0'} />
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

        {/* POS 設定 */}
        {(product.sellingPrice || product.isAvailableForPos) && (
          <Card title="POS 設定">
            <Row label="建議售價" value={product.sellingPrice ? product.sellingPrice.toString() : undefined} />
            <Row label="開放 POS 販售" value={product.isAvailableForPos ? '是' : '否'} />
            <Row label="POS 產品 ID" value={product.posProductId} />
          </Card>
        )}

        {/* 資料異動歷史 */}
        {product.history.length > 0 && (
          <Card title="資料異動歷史">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 font-medium">時間</th>
                    <th className="pb-2 font-medium">來源</th>
                    <th className="pb-2 font-medium">單據</th>
                    <th className="pb-2 font-medium">品名</th>
                    <th className="pb-2 font-medium">SKU</th>
                    <th className="pb-2 font-medium">規格</th>
                    <th className="pb-2 font-medium">成本</th>
                    <th className="pb-2 font-medium">操作人</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {product.history.map(h => (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="py-2 text-gray-500 whitespace-nowrap">{formatDate(h.createdAt)}</td>
                      <td className="py-2">
                        <SourceBadge type={h.sourceType} />
                      </td>
                      <td className="py-2">
                        {h.poOrderId
                          ? <Link href={`/purchases/${h.poOrderId}`} className="text-blue-600 hover:underline">{h.poOrderNo ?? h.poOrderId}</Link>
                          : <span className="text-gray-400">-</span>
                        }
                      </td>
                      <td className="py-2">{h.name}</td>
                      <td className="py-2 text-gray-500">{h.sku ?? '-'}</td>
                      <td className="py-2 text-gray-500 max-w-[160px] truncate">{h.specification ?? '-'}</td>
                      <td className="py-2 whitespace-nowrap">
                        {h.unitCost ? `${h.currency ?? ''} ${h.unitCost}` : '-'}
                      </td>
                      <td className="py-2 text-gray-500">{h.changer.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <p className="text-xs text-gray-400">建立時間：{formatDate(product.createdAt)}</p>
      </div>
    </div>
  )
}

const SOURCE_LABEL: Record<string, { text: string; cls: string }> = {
  PO_RECEIPT:  { text: '採購入庫', cls: 'bg-green-100 text-green-700' },
  AI_IMPORT:   { text: 'AI 匯入', cls: 'bg-purple-100 text-purple-700' },
  MANUAL_EDIT: { text: '手動編輯', cls: 'bg-gray-100 text-gray-600' },
}

function SourceBadge({ type }: { type: string }) {
  const s = SOURCE_LABEL[type] ?? { text: type, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${s.cls}`}>{s.text}</span>
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
