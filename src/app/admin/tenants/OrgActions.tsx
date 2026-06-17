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

  async function handleFixEmail() {
    const oldEmail = prompt('請輸入目前錯誤的 Email（loginId）：')
    if (!oldEmail) return
    const newEmail = prompt('請輸入正確的新 Email：')
    if (!newEmail) return
    setLoading(true)
    const res = await fetch(`/api/admin/orgs/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fix-user-email', oldEmail, newEmail }),
    })
    setLoading(false)
    const data = await res.json()
    if (res.ok) alert(`✅ 已更新為 ${data.updated}，請重新登入`)
    else alert(data.error ?? '更新失敗')
  }

  async function handleDelete() {
    if (!confirm('確定要永久刪除這個租戶？此操作將刪除 Neon DB 及所有資料，無法復原。')) return
    setLoading(true)
    const res = await fetch(`/api/admin/orgs/${orgId}`, { method: 'DELETE' })
    setLoading(false)
    if (res.ok) router.refresh()
    else {
      const data = await res.json()
      alert(data.error ?? '刪除失敗')
    }
  }

  return (
    <div className="flex gap-2 items-center">
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
      <button
        onClick={handleFixEmail}
        disabled={loading}
        className="text-xs text-blue-500 hover:underline disabled:opacity-50"
      >
        修正 Email
      </button>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="text-xs text-gray-400 hover:text-red-600 hover:underline disabled:opacity-50"
      >
        刪除
      </button>
    </div>
  )
}
