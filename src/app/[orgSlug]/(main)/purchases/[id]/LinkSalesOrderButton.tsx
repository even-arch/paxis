'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type SlsPI = { id: number; piNo: string; customerName: string | null; totalAmount: string | null; currencyCode: string | null }

export default function LinkSlsPIButton({ poId, currentSlsPiId, slsPIs }: { poId: number; currentSlsPiId: number | null; slsPIs: SlsPI[] }) {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [selected, setSelected] = useState(currentSlsPiId ? String(currentSlsPiId) : '')
  const [saving, setSaving]   = useState(false)

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/purchases/${poId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slsPiId: selected ? Number(selected) : null }),
    })
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="inline-block">
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-xs text-blue-600 hover:text-blue-800 hover:underline">
          {currentSlsPiId ? '變更連結' : '+ 連結我方 PI'}
        </button>
      ) : (
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <select value={selected} onChange={e => setSelected(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus>
            <option value="">（無連結）</option>
            {slsPIs.map(p => (
              <option key={p.id} value={p.id}>
                {p.piNo}{p.customerName ? ` — ${p.customerName}` : ''}{p.totalAmount ? ` (${p.currencyCode} ${Number(p.totalAmount).toLocaleString()})` : ''}
              </option>
            ))}
          </select>
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? '儲存...' : '確認'}
          </button>
          <button onClick={() => { setOpen(false); setSelected(currentSlsPiId ? String(currentSlsPiId) : '') }}
            className="text-gray-500 hover:text-gray-700 text-sm px-2 py-1">取消</button>
        </div>
      )}
    </div>
  )
}
