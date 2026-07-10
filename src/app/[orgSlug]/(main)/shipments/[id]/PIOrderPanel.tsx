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

export default function PIOrderPanel({ piList, shipmentId, orgSlug }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [modalList, setModalList] = useState<PiEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const dragIdx = useRef<number | null>(null)

  const missingPO = piList.filter(p => p.poOrders.length === 0)
  const hasMultiple = piList.length > 1

  function openModal() {
    setModalList([...piList])
    setModalOpen(true)
  }

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

  function handleDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault()
    setDragOver(null)
    const from = dragIdx.current
    dragIdx.current = null
    if (from === null || from === targetIdx) return
    const newList = [...modalList]
    const [moved] = newList.splice(from, 1)
    newList.splice(targetIdx, 0, moved)
    setModalList(newList)
  }

  function handleDragEnd() {
    dragIdx.current = null
    setDragOver(null)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/pi-order`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ piIds: modalList.map(p => p.piId) }),
      })
      if (!res.ok) throw new Error()
      setModalOpen(false)
      router.refresh()
    } catch {
      alert('儲存失敗，請重試')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">關聯 PI</h2>
          <div className="flex items-center gap-2">
            {hasMultiple && (
              <button
                onClick={openModal}
                className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                調整順序
              </button>
            )}
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
        </div>

        <div className="flex flex-col gap-2">
          {piList.map((pi) => {
            const hasPO = pi.poOrders.length > 0
            return (
              <div key={pi.piId} className={`flex items-start gap-3 border rounded px-3 py-2 text-sm ${hasPO ? 'border-gray-200' : 'border-orange-300 bg-orange-50'}`}>
                <span className={`mt-0.5 text-base ${hasPO ? 'text-green-500' : 'text-orange-500'}`}>{hasPO ? '✓' : '⚠'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={orgPath(orgSlug, `/sales/pi/${pi.piId}`)} className="font-mono text-teal-600 hover:underline font-medium">
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
                        <Link key={po.id} href={orgPath(orgSlug, `/purchases/${po.id}`)} className="text-xs text-blue-600 hover:underline font-mono">
                          PO: {po.poNo} <span className="text-gray-400 font-sans">({po.supplier.shortName ?? po.supplier.name})</span>
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

      {/* ── 排序 Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">調整 PI 順序</h3>
              <p className="text-xs text-gray-400 mt-0.5">拖拉調整後按「確認儲存」，裝箱明細與列印文件將同步更新</p>
            </div>

            <div className="px-6 py-4 flex flex-col gap-2 max-h-96 overflow-y-auto">
              {modalList.map((pi, idx) => (
                <div
                  key={pi.piId}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 border rounded px-3 py-2.5 text-sm cursor-grab active:cursor-grabbing select-none transition-colors
                    ${dragOver === idx ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                  `}
                >
                  <span className="text-gray-300 text-base">⠿</span>
                  <span className="text-xs text-gray-400 w-5 text-center">{idx + 1}</span>
                  <span className="font-mono text-gray-800 font-medium">{pi.piNo}</span>
                  {pi.poOrders.length > 0 && (
                    <span className="text-xs text-gray-400 truncate">
                      {pi.poOrders.map(p => p.supplier.shortName ?? p.supplier.name).join('、')}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '儲存中…' : '確認儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
