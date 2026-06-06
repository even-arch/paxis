'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type SalesOrder = {
  id: number
  orderNo: string
  customerName: string | null
}

export default function LinkSalesOrderButton({
  poId,
  currentSalesOrderId,
  salesOrders,
}: {
  poId: number
  currentSalesOrderId: number | null
  salesOrders: SalesOrder[]
}) {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [selected, setSelected] = useState(currentSalesOrderId ? String(currentSalesOrderId) : '')
  const [saving,  setSaving]  = useState(false)

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/purchases/${poId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salesOrderId: selected ? Number(selected) : null }),
    })
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  const currentOrder = salesOrders.find(s => s.id === currentSalesOrderId)

  return (
    <div className="inline-block">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
        >
          {currentSalesOrderId ? '變更連結' : '+ 連結客戶訂單'}
        </button>
      ) : (
        <div className="flex items-center gap-2 mt-1">
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          >
            <option value="">（無連結）</option>
            {salesOrders.map(s => (
              <option key={s.id} value={s.id}>
                {s.orderNo}{s.customerName ? ` — ${s.customerName}` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '儲存...' : '確認'}
          </button>
          <button
            onClick={() => { setOpen(false); setSelected(currentSalesOrderId ? String(currentSalesOrderId) : '') }}
            className="text-gray-500 hover:text-gray-700 text-sm px-2 py-1"
          >
            取消
          </button>
        </div>
      )}
    </div>
  )
}
