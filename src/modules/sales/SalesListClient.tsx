'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatCurrency } from '@/lib/utils'

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: '草稿',    color: 'bg-gray-100 text-gray-600' },
  1: { label: '已確認',  color: 'bg-blue-100 text-blue-700' },
  2: { label: 'PI 已發', color: 'bg-purple-100 text-purple-700' },
  3: { label: '部分出貨', color: 'bg-amber-100 text-amber-700' },
  4: { label: '完成',    color: 'bg-green-100 text-green-700' },
  5: { label: '取消',    color: 'bg-red-100 text-red-600' },
}

const SOURCE_LABELS: Record<string, string> = {
  PATISCO: 'Patisco', MANUAL: '手動', AI_IMPORT: 'AI 匯入', MARKETPLACE: '電商平台',
}

type Order = {
  id: number
  orderNo: string
  status: number
  source: string
  currencyCode: string
  totalAmount: { toString(): string } | null
  patiscoCreatedAt: Date | string | null
  customer: { name: string; shortName: string | null } | null
  patiscoBuyerName: string | null
  pis: { etd: Date | string | null }[]
}

type Props = {
  orders: Order[]
  isArchived: boolean
}

export default function SalesListClient({ orders, isArchived }: Props) {
  const router = useRouter()
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

    await fetch('/api/sales/archive', {
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
        <div className="mb-3 flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5">
          <span className="text-sm text-teal-700 font-medium">已選 {selectedIds.size} 張</span>
          <button onClick={() => doArchive(isArchived ? 'unarchive' : 'archive')} disabled={pending}
            className="text-sm px-3 py-1 rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
            {pending ? '處理中...' : isArchived ? '還原' : '封存'}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-sm text-teal-500 hover:text-teal-700 ml-auto">
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
              <th className="text-left px-4 py-3 font-medium text-gray-600">訂單號</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">客戶</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">幣別</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">金額</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">狀態</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">來源</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">ETD</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">建立日期</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                {isArchived ? '沒有封存的單據' : '尚無客戶訂單'}
              </td></tr>
            )}
            {orders.map(o => {
              const badge = STATUS_LABELS[o.status] ?? STATUS_LABELS[0]
              const customerName = o.customer?.name ?? o.patiscoBuyerName ?? '-'
              const isSelected = selectedIds.has(o.id)
              return (
                <tr key={o.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-teal-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={isSelected} onChange={() => toggle(o.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/sales/${o.id}`} className="font-mono font-medium text-teal-600 hover:underline">
                      {o.orderNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{customerName}</td>
                  <td className="px-4 py-3 text-gray-500">{o.currencyCode}</td>
                  <td className="px-4 py-3 text-right">
                    {o.totalAmount ? formatCurrency(o.totalAmount.toString(), o.currencyCode) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>{badge.label}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{SOURCE_LABELS[o.source] ?? o.source}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {o.pis[0]?.etd ? formatDate(o.pis[0].etd) : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{o.patiscoCreatedAt ? formatDate(o.patiscoCreatedAt) : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
