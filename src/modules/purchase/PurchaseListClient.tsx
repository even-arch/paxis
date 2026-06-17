'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useOrgPath } from '@/lib/use-org-path'
import { formatDate } from '@/lib/utils'
import { statusBadge } from '@/modules/purchase/poUtils'

type Order = {
  id: number
  poNo: string
  patiscoOrderNo: string | null
  status: number
  expectedDate: Date | string | null
  orderDate: Date | string | null
  supplier: { name: string; shortName: string | null }
  _count: { items: number }
}

type Props = {
  orders: Order[]
  isArchived: boolean
}

export default function PurchaseListClient({ orders, isArchived }: Props) {
  const router = useRouter()
  const toOrgPath = useOrgPath()
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [pending, startTransition] = useTransition()

  function toggle(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(orders.map(o => o.id)))
    }
  }

  async function doArchive(action: 'archive' | 'unarchive') {
    if (selectedIds.size === 0) return
    const label = action === 'archive' ? '封存' : '還原'
    if (!confirm(`確定要${label}選取的 ${selectedIds.size} 張單據嗎？`)) return

    await fetch('/api/purchases/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds), action }),
    })

    setSelectedIds(new Set())
    startTransition(() => router.refresh())
  }

  return (
    <div>
      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <span className="text-sm text-blue-700 font-medium">已選 {selectedIds.size} 張</span>
          <button onClick={() => doArchive(isArchived ? 'unarchive' : 'archive')} disabled={pending}
            className="text-sm px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {pending ? '處理中...' : isArchived ? '還原' : '封存'}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-sm text-blue-500 hover:text-blue-700 ml-auto">
            取消選取
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 w-8">
                <input type="checkbox"
                  checked={selectedIds.size === orders.length && orders.length > 0}
                  onChange={toggleAll} className="rounded" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">供應商訂單號</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Patisco 訂單</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">供應商</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">狀態</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">預計到貨</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">項目</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">建立日期</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                {isArchived ? '沒有封存的單據' : '尚無供應商訂單'}
              </td></tr>
            )}
            {orders.map(o => {
              const badge = statusBadge(o.status)
              const isSelected = selectedIds.has(o.id)
              return (
                <tr key={o.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={isSelected} onChange={() => toggle(o.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={toOrgPath(`/purchases/${o.id}`)} className="font-medium text-blue-600 hover:underline font-mono">
                      {o.poNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{o.patiscoOrderNo ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{o.supplier.shortName ?? o.supplier.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>{badge.label}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{o.expectedDate ? formatDate(o.expectedDate) : '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{o._count.items}</td>
                  <td className="px-4 py-3 text-gray-400">{o.orderDate ? formatDate(o.orderDate) : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
