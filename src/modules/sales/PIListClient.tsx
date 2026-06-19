'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useOrgPath } from '@/lib/use-org-path'
import { formatDate } from '@/lib/utils'
import SortableHeader from '@/components/SortableHeader'

type PI = {
  id: number
  piNo: string
  piDate: Date | string | null
  estimatedShipDate: Date | string | null
  status: number
  patiscoCreatedAt: Date | string | null
  order: { id: number; orderNo: string; customer: { name: string; shortName: string | null } | null } | null
  _count: { items: number }
}

type Props = { pis: PI[]; isArchived: boolean; sort: string; dir: 'asc' | 'desc' }

export default function PIListClient({ pis, isArchived, sort, dir }: Props) {
  const router = useRouter()
  const toOrgPath = useOrgPath()
  const searchParams = useSearchParams()

  function buildUrl(newSort: string, newDir: 'asc' | 'desc') {
    const p = new URLSearchParams(searchParams.toString())
    p.set('sort', newSort)
    p.set('dir', newDir)
    p.delete('page')
    return toOrgPath(`/sales/pi?${p.toString()}`)
  }
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [pending, startTransition] = useTransition()

  function toggle(id: number) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    setSelectedIds(selectedIds.size === pis.length ? new Set() : new Set(pis.map(p => p.id)))
  }
  async function doArchive(action: 'archive' | 'unarchive') {
    if (!selectedIds.size) return
    if (!confirm(`確定要${action === 'archive' ? '封存' : '還原'}選取的 ${selectedIds.size} 筆 PI？`)) return
    await fetch('/api/sales/pi/archive', {
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
          <span className="text-sm text-teal-700 font-medium">已選 {selectedIds.size} 筆</span>
          <button onClick={() => doArchive(isArchived ? 'unarchive' : 'archive')} disabled={pending}
            className="text-sm px-3 py-1 rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
            {pending ? '處理中...' : isArchived ? '還原' : '封存'}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-sm text-teal-500 hover:text-teal-700 ml-auto">取消選取</button>
        </div>
      )}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 w-8">
                <input type="checkbox" checked={selectedIds.size === pis.length && pis.length > 0} onChange={toggleAll} className="rounded" />
              </th>
              <SortableHeader label="PI 號碼" field="piNo" sort={sort} dir={dir} buildUrl={buildUrl} />
              <th className="text-left px-4 py-3 font-medium text-gray-600">客戶</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">對應訂單</th>
              <SortableHeader label="PI 日期" field="piDate" sort={sort} dir={dir} buildUrl={buildUrl} />
              <SortableHeader label="預計出貨" field="estimatedShipDate" sort={sort} dir={dir} buildUrl={buildUrl} />
              <th className="text-right px-4 py-3 font-medium text-gray-600">品項</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">狀態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pis.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                {isArchived ? '沒有封存的 PI' : '尚無 PI 資料'}
              </td></tr>
            )}
            {pis.map(pi => {
              const isSelected = selectedIds.has(pi.id)
              const customerName = pi.order?.customer?.shortName ?? pi.order?.customer?.name ?? '-'
              return (
                <tr key={pi.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-teal-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={isSelected} onChange={() => toggle(pi.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-3">
                    {pi.order ? (
                      <Link href={toOrgPath(`/sales/${pi.order.id}`)} className="font-mono font-medium text-teal-600 hover:underline">
                        {pi.piNo}
                      </Link>
                    ) : (
                      <span className="font-mono font-medium text-gray-700">{pi.piNo}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{customerName}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{pi.order?.orderNo ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{pi.piDate ? formatDate(pi.piDate) : '-'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{pi.estimatedShipDate ? formatDate(pi.estimatedShipDate) : '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{pi._count.items}</td>
                  <td className="px-4 py-3">
                    {pi.status === 1
                      ? <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">已取消</span>
                      : <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">有效</span>
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
