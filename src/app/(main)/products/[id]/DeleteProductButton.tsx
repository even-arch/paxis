'use client'

import { useRouter } from 'next/navigation'

export default function DeleteProductButton({ productId }: { productId: string }) {
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('確定要刪除此商品？此動作無法復原。')) return

    const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/products')
      router.refresh()
    }
  }

  return (
    <button
      onClick={handleDelete}
      className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-md text-sm hover:bg-red-100"
    >
      刪除
    </button>
  )
}
