'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import LinkPOButton from '@/app/[orgSlug]/(main)/sales/pi/[piId]/LinkPOButton'
import { orgPath } from '@/lib/org-path'

export type PiEntry = {
  piId: number
  piNo: string
  orderId?: number | null
  orderNo?: string | null
  etd?: Date | string | null
  poOrders: { id: number; poNo: string; supplier: { shortName: string | null; name: string } }[]
}

type Props = {
  piList: PiEntry[]
  shipmentId: number
  orgSlug: string
}

export default function PIOrderPanel({ piList: initialList, shipmentId, orgSlug }: Props) {
  const router = useRouter()
  const [piList, setPiList] = useState(initialList)
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const dragIdx = useRef<number | null>(null)

  const missingPO = piList.filter(p => p.poOrders.length === 0)
  const hasMultiple = piList.length > 1

  function handleDragStart(idx: number) {
    dragIdx.current = idx
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    setDragOver(idx)
  }

  function handleDragLeave() {
    setDragOver(null)
  }

  async function handleDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault()
    setDragOver(null)
    const from = dragIdx.current
    dragIdx.current = null
    if (from === null || from === targetIdx) return

    const newList = [...piList]
    const [moved] = newList.splice(from, 1)
    newList.splice(targetIdx, 0, moved)
    setPiList(newList)

    setSaving(true)
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/pi-order`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ piIds: newList.map(p => p.piId) }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      setPiList(initialList)
    } finally {
      setSaving(false)
    }
  }

  function handleDragEnd() {
    dragIdx.current = null
    setDragOver(null)
  }

  return (
    <div className="bg-white rounded-lg shadow p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">關聯 PI</h2>
          {hasMultiple && (
            <span className="text-xs text-gray-400">（可拖拉調整順序）</span>
          )}
          {saving && <span className="text-xs text-blue-500">儲存中…</span>}
        </div>
        {missingPO.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1">
            ⚠ {missingPO.length} 張 PI 尚未連結採購單（PO）
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
            ✓ 全部 PI 均已連結 PO
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {piList.map((pi, idx) => {
          const hasPO = pi.poOrders.length > 0
          const isOver = dragOver === idx
          return (
            <div
              key={pi.piId}
              draggable={hasMultiple}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={`flex items-start gap-3 border rounded px-3 py-2 text-sm transition-colors
                ${hasPO ? 'border-gray-200' : 'border-orange-300 bg-orange-50'}
                ${isOver ? 'border-blue-400 bg-blue-50' : ''}
                ${hasMultiple ? 'cursor-grab active:cursor-grabbing' : ''}
              `}
            >
              {hasMultiple && (
                <span className="mt-0.5 text-gray-300 select-none text-base leading-none">⠿</span>
              )}
              <span className={`mt-0.5 text-base ${hasPO ? 'text-green-500' : 'text-orange-500'}`}>
                {hasPO ? '✓' : '⚠'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={orgPath(orgSlug, `/sales/pi/${pi.piId}`)}
                    className="font-mono text-teal-600 hover:underline font-medium"
                    onClick={e => e.stopPropagation()}
                  >
                    {pi.piNo}
                  </Link>
                  {pi.etd && (
                    <span className="text-gray-400 text-xs">
                      ETD: {typeof pi.etd === 'string' ? pi.etd : new Date(pi.etd).toLocaleDateString('zh-TW')}
                    </span>
                  )}
                </div>
                {hasPO ? (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {pi.poOrders.map(po => (
                      <Link
                        key={po.id}
                        href={orgPath(orgSlug, `/purchases/${po.id}`)}
                        className="text-xs text-blue-600 hover:underline font-mono"
                        onClick={e => e.stopPropagation()}
                      >
                        PO: {po.poNo}{' '}
                        <span className="text-gray-400 font-sans">
                          ({po.supplier.shortName ?? po.supplier.name})
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-xs text-orange-700">尚未連結採購單</span>
                    <LinkPOButton piId={pi.piId} linkedPOIds={[]} initialQuery={pi.piNo} />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
