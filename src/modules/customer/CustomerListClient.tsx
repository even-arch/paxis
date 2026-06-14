'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Customer = {
  id: number
  name: string
  shortName: string | null
  countryCode: string | null
  paymentTerms: string | null
  currencyCode: string | null
  _count: { salesOrders: number }
}

type Props = { customers: Customer[]; isArchived: boolean }

export default function CustomerListClient({ customers, isArchived }: Props) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [pending, startTransition] = useTransition()

  function toggle(id: number) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    setSelectedIds(selectedIds.size === customers.length ? new Set() : new Set(customers.map(c => c.id)))
  }
  async function doArchive(action: 'archive' | 'unarchive') {
    if (!selectedIds.size) return
    if (!confirm(`確定要${action === 'archive' ? '封存' : '還原'}選取的 ${selectedIds.size} 筆客戶？`)) return
    await fetch('/api/customers/archive', {
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
                <input type="checkbox" checked={selectedIds.size === customers.length && customers.length > 0} onChange={toggleAll} className="rounded" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">客戶名稱</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">簡稱</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">國家</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">付款條件</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">幣別</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">訂單數</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                {isArchived ? '沒有封存的客戶' : '尚無客戶，請新增'}
              </td></tr>
            )}
            {customers.map(c => {
              const sel = selectedIds.has(c.id)
              return (
                <tr key={c.id} className={`hover:bg-gray-50 ${sel ? 'bg-teal-50' : ''}`}>
                  <td className="px-4 py-3"><input type="checkbox" checked={sel} onChange={() => toggle(c.id)} className="rounded" /></td>
                  <td className="px-4 py-3"><Link href={`/customers/${c.id}`} className="font-medium text-blue-600 hover:underline">{c.name}</Link></td>
                  <td className="px-4 py-3 text-gray-500">{c.shortName ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.countryCode ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.paymentTerms ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.currencyCode ?? '-'}</td>
                  <td className="px-4 py-3 text-right">
                    {c._count.salesOrders > 0
                      ? <span className="text-teal-600">{c._count.salesOrders} 筆</span>
                      : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/customers/${c.id}/edit`} className="text-gray-400 hover:text-blue-600 text-xs">編輯</Link>
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
