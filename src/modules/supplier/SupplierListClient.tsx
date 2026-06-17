'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useOrgPath } from '@/lib/use-org-path'

type Supplier = {
  id: number
  name: string
  shortName: string | null
  countryCode: string | null
  paymentTerms: string | null
  currencyCode: string | null
  _count: { products: number }
}

type Props = { suppliers: Supplier[]; isArchived: boolean }

export default function SupplierListClient({ suppliers, isArchived }: Props) {
  const router = useRouter()
  const toOrgPath = useOrgPath()
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [pending, startTransition] = useTransition()

  function toggle(id: number) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    setSelectedIds(selectedIds.size === suppliers.length ? new Set() : new Set(suppliers.map(s => s.id)))
  }
  async function doArchive(action: 'archive' | 'unarchive') {
    if (!selectedIds.size) return
    if (!confirm(`確定要${action === 'archive' ? '封存' : '還原'}選取的 ${selectedIds.size} 筆供應商？`)) return
    await fetch('/api/suppliers/archive', {
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
          <span className="text-sm text-blue-700 font-medium">已選 {selectedIds.size} 筆</span>
          <button onClick={() => doArchive(isArchived ? 'unarchive' : 'archive')} disabled={pending}
            className="text-sm px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {pending ? '處理中...' : isArchived ? '還原' : '封存'}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-sm text-blue-500 hover:text-blue-700 ml-auto">取消選取</button>
        </div>
      )}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 w-8">
                <input type="checkbox" checked={selectedIds.size === suppliers.length && suppliers.length > 0} onChange={toggleAll} className="rounded" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">供應商名稱</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">簡稱</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">國家</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">付款條件</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">幣別</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">商品數</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {suppliers.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                {isArchived ? '沒有封存的供應商' : '尚無供應商，請新增'}
              </td></tr>
            )}
            {suppliers.map(s => {
              const sel = selectedIds.has(s.id)
              return (
                <tr key={s.id} className={`hover:bg-gray-50 ${sel ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3"><input type="checkbox" checked={sel} onChange={() => toggle(s.id)} className="rounded" /></td>
                  <td className="px-4 py-3"><Link href={toOrgPath(`/suppliers/${s.id}`)} className="font-medium text-blue-600 hover:underline">{s.name}</Link></td>
                  <td className="px-4 py-3 text-gray-500">{s.shortName ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.countryCode ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.paymentTerms ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.currencyCode ?? '-'}</td>
                  <td className="px-4 py-3 text-right">
                    {s._count.products > 0
                      ? <Link href={toOrgPath(`/products?supplierId=${s.id}`)} className="text-blue-600 hover:underline">{s._count.products} 項</Link>
                      : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={toOrgPath(`/suppliers/${s.id}/edit`)} className="text-gray-400 hover:text-blue-600 text-xs">編輯</Link>
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
