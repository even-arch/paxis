import ProductForm from '@/modules/product/ProductForm'

export default function NewProductPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">新增商品</h1>
      <ProductForm />
    </div>
  )
}
