'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type OutstandingNotice = { id: number; noticeNo: string; status: string; supplierName: string }
const NOTICE_STATUS_LABEL: Record<string, string> = { DRAFT: '草稿', SENT: '已寄送' }

export default function ConfirmShipmentButton({ shipmentId, alreadyConfirmed }: {
  shipmentId: number
  alreadyConfirmed: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(alreadyConfirmed)
  const [error, setError] = useState('')

  // 彈窗：按下按鈕時才查「尚未收尾」的項目，跟有沒有上傳報關文件無關
  const [modalOpen, setModalOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const [notices, setNotices] = useState<OutstandingNotice[]>([])
  const [checkedNotices, setCheckedNotices] = useState<Set<number>>(new Set())

  async function openModal() {
    setChecking(true)
    setError('')
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/outstanding`)
      const data = await res.json() as { notices?: OutstandingNotice[] }
      const list = data.notices ?? []
      setNotices(list)
      setCheckedNotices(new Set(list.map(n => n.id))) // 預設全選
      setModalOpen(true)
    } catch {
      // 查詢失敗不擋住主流程，直接開窗（空清單）
      setNotices([])
      setCheckedNotices(new Set())
      setModalOpen(true)
    } finally {
      setChecking(false)
    }
  }

  function toggleNotice(id: number) {
    setCheckedNotices(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleConfirm() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/confirm-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noticeIds: Array.from(checkedNotices), confirmShipment: true }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(json.error ?? '操作失敗')
      setDone(true)
      setModalOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {done && <span className="text-xs text-green-600 font-medium">✓ 庫存已扣減</span>}
      <button
        onClick={openModal}
        disabled={checking}
        className={`px-4 py-2 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors ${done ? 'bg-gray-400 hover:bg-gray-500' : 'bg-teal-600 hover:bg-teal-700'}`}
      >
        {checking ? '檢查中…' : done ? '補建財務記錄' : '✈ 確認出貨（驅動庫存）'}
      </button>
      {error && !modalOpen && <span className="text-xs text-red-500">{error}</span>}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !loading && setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">
                {done ? '補建財務記錄' : '確認出貨'}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {done
                  ? '庫存已扣減過，會嘗試補建缺漏的應收帳款。'
                  : '系統將寫入庫存扣減（quantity--）並建立應收帳款，此動作不可逆。'}
              </p>
            </div>

            {notices.length > 0 && (
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-600 mb-2">
                  以下供應商出貨通知單尚未標記為已確認——若供應商已透過電話、LINE 等其他管道確認出貨
                  （不一定會走系統 Email 流程），可一併勾選標記完成：
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {notices.map(n => (
                    <label key={n.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checkedNotices.has(n.id)}
                        onChange={() => toggleNotice(n.id)}
                        className="rounded"
                      />
                      <span className="font-mono text-xs text-blue-700">{n.noticeNo}</span>
                      <span className="text-gray-600">{n.supplierName}</span>
                      <span className="text-xs text-gray-400">（目前：{NOTICE_STATUS_LABEL[n.status] ?? n.status}）</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-500 px-6 pt-3">{error}</p>}

            <div className="px-6 py-4 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                disabled={loading}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="px-4 py-2 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50"
              >
                {loading ? '處理中…' : '確認執行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
