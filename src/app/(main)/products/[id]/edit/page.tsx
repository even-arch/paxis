import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import ProductForm from '@/modules/product/ProductForm'
import { ProductFormData } from '@/modules/product/productSchema'

type Props = { params: { id: string } }

export default async function EditProductPage({ params }: Props) {
  const product = await prisma.pRD_Product.findUnique({
    where: { id: Number(params.id) },
  })

  if (!product || !product.isActive) notFound()

  const initialData: Partial<ProductFormData> = {
    name: product.name,
    sku: product.sku ?? '',
    modelNo: product.modelNo ?? '',
    description: product.description ?? '',
    specification: product.specification ?? '',
    unit: product.unit ?? '',
    unitPerInner: product.unitPerInner?.toString() ?? '',
    unitPerCarton: product.unitPerCarton?.toString() ?? '',
    cbm: product.cbm?.toString() ?? '',
    grossWeight: product.grossWeight?.toString() ?? '',
    netWeight: product.netWeight?.toString() ?? '',
    length: product.length?.toString() ?? '',
    width: product.width?.toString() ?? '',
    height: product.height?.toString() ?? '',
    htsCode: product.htsCode ?? '',
    countryOfOrigin: product.countryOfOrigin ?? '',
    isMadeToOrder: product.isMadeToOrder ?? false,
    safetyStock: product.safetyStock?.toString() ?? '0',
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">編輯商品</h1>
      <ProductForm initialData={initialData} productId={params.id} />
    </div>
  )
}
