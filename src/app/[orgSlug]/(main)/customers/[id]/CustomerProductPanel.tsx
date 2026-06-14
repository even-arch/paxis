'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CustomerProduct {
  id: number
  productId: number
  lastUnitPrice: string | null
  currencyCode: string | null
  lastOrderDate: string | null
  orderCount: number
  product: { id: number; name: string; sku: string | null }
}

export default function CustomerProductPanel({
  customerId,
  products,
}: {
  customerId: number
  products: CustomerProduct[]
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<number | null>(null)

  async function handleDelete(id: number, productName: string) {
    if (!confirm(`確定移除「${productName}」與此客戶的商品關聯？\n（不影響已有的訂單記錄）`)) return
    setDeleting(id)
    try {
      await fetch(`/api/customers/${customerId}/products/${id}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setDeleting(null)
    }
  }

  if (products.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-2">
        尚無記錄。建立客戶訂單後會自動更新。
      </p>
    )
  }

  return (
    <div className="divide-y divide-gray-50">
      {products.map(p => (
        <div key={p.id} className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm font-medium text-gray-800">{p.product.name}</span>
            {p.product.sku && (
              <span className="ml-2 text-xs font-mono text-gray-400">{p.product.sku}</span>
            )}
            <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
              {p.lastUnitPrice && (
                <span>最近成交價：{p.currencyCode} {Number(p.lastUnitPrice).toFixed(2)}</span>
              )}
              {p.orderCount > 1 && <span>下單 {p.orderCount} 次</span>}
              {p.lastOrderDate && (
                <span>{new Date(p.lastOrderDate).toLocaleDateString('zh-TW')}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleDelete(p.id, p.product.name)}
            disabled={deleting === p.id}
            className="text-xs text-gray-300 hover:text-red-500 disabled:opacity-50 px-2 py-1"
          >
            {deleting === p.id ? '…' : '✕'}
          </button>
        </div>
      ))}
    </div>
  )
}
