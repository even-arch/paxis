'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function UnlinkPOButton({ poId, poNo }: { poId: number; poNo: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function unlink() {
    if (!confirm(`確定要取消 ${poNo} 與此 PI 的連結？`)) return
    setLoading(true)
    await fetch(`/api/purchases/${poId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slsPiId: null }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={unlink}
      disabled={loading}
      title={`取消連結 ${poNo}`}
      className="ml-1 text-gray-300 hover:text-red-500 transition-colors text-sm leading-none disabled:opacity-40"
    >
      ✕
    </button>
  )
}
