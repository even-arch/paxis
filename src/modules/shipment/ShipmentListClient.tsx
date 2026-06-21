'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useOrgPath } from '@/lib/use-org-path'
import { formatDate } from '@/lib/utils'
import SortableHeader from '@/components/SortableHeader'

const SOURCE_LABELS: Record<string, string> = {
  PATISCO: 'Patisco', MANUAL: '手動', AI_IMPORT: 'AI 匯入', UPS: 'UPS',
}

type Shipment = {
  id: number
  shipmentNo: string
  actualShipDate: Date | string | null
  portOfLoading: string | null
  currencyCode: string | null
  source: string
  performedAt: Date | string
  customer: { name: string; shortName: string | null } | null
  _count: { items: number; pis: number }
  pis: Array<{ pi: { piNo: string } }>
  stockMovements: Array<{ id: number }>
}

type Props = { shipments: Shipment[]; isArchived: boolean; sort: string; dir: 'asc' | 'desc' }

export default function ShipmentListClient({ shipments, isArchived, sort, dir }: Props) {
  const router = useRouter()
  const toOrgPath = useOrgPath()
  const searchParams = useSearchParams()

  function buildUrl(newSort: string, newDir: 'asc' | 'desc') {
    const p = new URLSearchParams(searchParams.toString())
    p.set('sort', newSort)
    p.set('dir', newDir)
    p.delete('page')
    return toOrgPath(`/shipments?${p.toString()}`)
  }
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [pending, startTransition] = useTransition()

  function toggle(id: number) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    setSelectedIds(selectedIds.size === shipments.length ? new Set() : new Set(shipments.map(s => s.id)))
  }
  async function doArchive(action: 'archive' | 'unarchive') {
    if (!selectedIds.size) return
    if (!confirm(`確定要${action === 'archive' ? '封存' : '還原'}選取的 ${selectedIds.size} 筆出貨單？`)) return
    await fetch('/api/shipments/archive', {
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
                <input type="checkbox" checked={selectedIds.size === shipments.length && shipments.length > 0} onChange={toggleAll} className="rounded" />
              </th>
              <SortableHeader label="出貨單號" field="shipmentNo" sort={sort} dir={dir} buildUrl={buildUrl} />
              <th className="text-left px-4 py-3 font-medium text-gray-600">客戶</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">關聯 PI</th>
              <SortableHeader label="出貨日期" field="actualShipDate" sort={sort} dir={dir} buildUrl={buildUrl} />
              <th className="text-left px-4 py-3 font-medium text-gray-600">裝貨港</th>
              <SortableHeader label="幣別" field="currencyCode" sort={sort} dir={dir} buildUrl={buildUrl} />
              <SortableHeader label="來源" field="source" sort={sort} dir={dir} buildUrl={buildUrl} />
              <SortableHeader label="匯入日期" field="performedAt" sort={sort} dir={dir} buildUrl={buildUrl} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shipments.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                {isArchived ? '沒有封存的出貨單' : '尚無出貨單資料'}
              </td></tr>
            )}
            {shipments.map(s => {
              const isSelected = selectedIds.has(s.id)
              const customerName = s.customer?.shortName ?? s.customer?.name ?? '-'
              const piNos = s.pis.map(sp => sp.pi.piNo).join(', ')
              return (
                <tr key={s.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-teal-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={isSelected} onChange={() => toggle(s.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={toOrgPath(`/shipments/${s.id}`)} className="font-mono font-medium text-teal-600 hover:underline">
                        {s.shipmentNo}
                      </Link>
                      {s.stockMovements.length > 0
                        ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">已出貨</span>
                        : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">待確認</span>
                      }
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{customerName}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                    {piNos || <span className="text-gray-300">-</span>}
                    {s._count.pis > 3 && <span className="text-gray-400"> +{s._count.pis - 3}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{formatDate(s.actualShipDate)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.portOfLoading ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.currencyCode ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{SOURCE_LABELS[s.source] ?? s.source}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(s.performedAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
