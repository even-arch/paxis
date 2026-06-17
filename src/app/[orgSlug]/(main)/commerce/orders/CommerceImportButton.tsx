'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useOrgPath } from '@/lib/use-org-path'

type Props = {
  orderId: string
  canImport: boolean
  importedOrderId?: number
}

export default function CommerceImportButton({ orderId, canImport, importedOrderId }: Props) {
  const router = useRouter()
  const go = useOrgPath()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (importedOrderId) {
    return (
      <Link
        href={go(`/sales/${importedOrderId}`)}
        className="inline-flex items-center justify-center rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
      >
        查看 Paxis 訂單
      </Link>
    )
  }

  async function handleImport() {
    if (!canImport || loading) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/commerce/mock-orders/${encodeURIComponent(orderId)}/import`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? '匯入失敗')
      }

      router.push(go(`/sales/${data.orderId}`))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '匯入失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={!canImport || loading}
        onClick={handleImport}
        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {loading ? '匯入中' : canImport ? '匯入並預留' : '庫存不足'}
      </button>
      {error && <span className="max-w-48 text-right text-xs text-red-600">{error}</span>}
    </div>
  )
}
