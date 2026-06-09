'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeletePoItemButton({ orderId, itemId }: { orderId: number; itemId: number }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/purchases/${orderId}/items?itemId=${itemId}`, { method: 'DELETE' })
      const json = await res.json() as { error?: string }
      if (!res.ok) { alert(json.error ?? '刪除失敗'); return }
      router.refresh()
    } finally {
      setDeleting(false)
      setConfirm(false)
    }
  }

  if (confirm) {
    return (
      <span className="inline-flex items-center gap-1">
        <button onClick={handleDelete} disabled={deleting}
          className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700 disabled:opacity-50">
          {deleting ? '…' : '確認刪除'}
        </button>
        <button onClick={() => setConfirm(false)} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
      </span>
    )
  }

  return (
    <button onClick={() => setConfirm(true)}
      className="text-xs text-red-400 hover:text-red-600 hover:underline">
      刪除
    </button>
  )
}
