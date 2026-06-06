'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function DeleteCustomerButton({ customerId }: { customerId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)

  async function handleDelete() {
    const res = await fetch(`/api/customers/${customerId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/customers')
      router.refresh()
    }
  }

  if (confirming) {
    return (
      <div className="flex gap-2">
        <button onClick={handleDelete}
          className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700">
          確認刪除
        </button>
        <button onClick={() => setConfirming(false)}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
          取消
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="border border-red-300 text-red-600 px-4 py-2 rounded-md text-sm hover:bg-red-50">
      刪除
    </button>
  )
}
