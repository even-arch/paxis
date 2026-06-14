'use client'

import { useRouter } from 'next/navigation'

export default function DeleteSupplierButton({ supplierId }: { supplierId: string }) {
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('確定要刪除此供應商？')) return
    const res = await fetch(`/api/suppliers/${supplierId}`, { method: 'DELETE' })
    if (res.ok) { router.push('/suppliers'); router.refresh() }
  }

  return (
    <button onClick={handleDelete}
      className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-md text-sm hover:bg-red-100">
      刪除
    </button>
  )
}
