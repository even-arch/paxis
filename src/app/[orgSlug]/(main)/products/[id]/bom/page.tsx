export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPagePrisma } from '@/lib/page-db'
import { orgPath } from '@/lib/org-path'
import BomEditor from './BomEditor'

type Props = { params: { orgSlug: string; id: string } }

const TYPE_LABEL: Record<number, string> = { 0: '成品', 1: '半成品', 2: '原物料/零件' }

export default async function ProductBomPage({ params }: Props) {
  const prisma = await getPagePrisma(params.orgSlug)
  const product = await prisma.pRD_Product.findUnique({
    where: { id: Number(params.id) },
    select: { id: true, name: true, sku: true, unit: true, productType: true, isActive: true },
  })

  if (!product || !product.isActive) notFound()

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={orgPath(params.orgSlug, `/products/${product.id}`)} className="text-sm text-gray-400 hover:text-gray-600">
          ← {product.name}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-800">BOM 物料清單</h1>
        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
          {TYPE_LABEL[product.productType] ?? '成品'}
        </span>
      </div>

      {product.productType === 2 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700 mb-6">
          此產品類型為「原物料/零件」，通常不需要 BOM。若它其實是加工後的半成品，請先到編輯頁調整產品類型。
        </div>
      )}

      <BomEditor
        productId={product.id}
        productName={product.name}
        productUnit={product.unit}
        orgSlug={params.orgSlug}
      />
    </div>
  )
}
