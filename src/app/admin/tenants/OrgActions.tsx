'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function OrgActions({
  orgId,
  currentStatus,
  hasDatabaseUrl,
}: {
  orgId: number
  currentStatus: string
  hasDatabaseUrl: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function patch(action: string) {
    setLoading(true)
    const res = await fetch(`/api/admin/orgs/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setLoading(false)
    if (res.ok) router.refresh()
    else {
      const data = await res.json()
      alert(data.error ?? '操作失敗')
    }
  }

  return (
    <div className="flex gap-2">
      {currentStatus === 'pending' && (
        <button
          onClick={() => patch('activate')}
          disabled={loading}
          className="text-xs text-green-700 hover:underline disabled:opacity-50"
          title={hasDatabaseUrl ? '啟用' : '啟用並自動開通 Neon DB'}
        >
          {loading ? '處理中...' : '啟用'}
        </button>
      )}
      {currentStatus === 'active' && (
        <button
          onClick={() => patch('suspend')}
          disabled={loading}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          停用
        </button>
      )}
      {currentStatus === 'suspended' && (
        <button
          onClick={() => patch('activate')}
          disabled={loading}
          className="text-xs text-green-700 hover:underline disabled:opacity-50"
        >
          重新啟用
        </button>
      )}
    </div>
  )
}
