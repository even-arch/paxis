'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  productId: string
  currentStock: number
  safetyStock: number
  unit: string
}

export default function InventoryControls({ productId, currentStock, safetyStock, unit }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'none' | 'adjust' | 'safety'>('none')
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustType, setAdjustType] = useState('3')
  const [adjustNote, setAdjustNote] = useState('')
  const [newSafety, setNewSafety] = useState(String(safetyStock))
  const [saving, setSaving] = useState(false)

  const preview = currentStock + (parseInt(adjustQty) || 0)

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault()
    const qty = parseInt(adjustQty)
    if (!qty) return

    setSaving(true)
    const res = await fetch(`/api/inventory/${productId}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: qty, type: Number(adjustType), note: adjustNote }),
    })
    setSaving(false)

    if (res.ok) {
      setMode('none')
      setAdjustQty('')
      setAdjustNote('')
      router.refresh()
    }
  }

  async function handleSafety(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/inventory/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ safetyStock: Number(newSafety) }),
    })
    setSaving(false)
    if (res.ok) { setMode('none'); router.refresh() }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-4">
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setMode(mode === 'adjust' ? 'none' : 'adjust')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${mode === 'adjust' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
          手動調整庫存
        </button>
        <button
          onClick={() => setMode(mode === 'safety' ? 'none' : 'safety')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${mode === 'safety' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
          設定安全庫存
        </button>
      </div>

      {/* 手動調整表單 */}
      {mode === 'adjust' && (
        <form onSubmit={handleAdjust} className="border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-600 mb-3">
            調整庫存數量（正數=入庫，負數=出庫）
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">調整類型</label>
              <select value={adjustType} onChange={e => setAdjustType(e.target.value)} className={inp}>
                <option value="5">手動調整入庫</option>
                <option value="6">手動調整出庫</option>
                <option value="7">盤點調整</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">調整數量 ({unit})</label>
              <input
                type="number"
                value={adjustQty}
                onChange={e => setAdjustQty(e.target.value)}
                placeholder="例：+50 或 -10"
                className={inp}
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">備註</label>
              <input type="text" value={adjustNote} onChange={e => setAdjustNote(e.target.value)}
                className={inp} placeholder="調整原因..." />
            </div>
          </div>

          {adjustQty && (
            <div className="mt-3 p-3 bg-gray-50 rounded-md text-sm">
              <span className="text-gray-500">調整後庫存：</span>
              <span className={`font-bold ml-2 ${preview < 0 ? 'text-red-600' : preview === 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                {Math.max(0, preview).toLocaleString()} {unit}
              </span>
              {preview < 0 && <span className="text-red-500 text-xs ml-2">（庫存不足，將歸零）</span>}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving || !adjustQty}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? '調整中...' : '確認調整'}
            </button>
            <button type="button" onClick={() => setMode('none')}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
              取消
            </button>
          </div>
        </form>
      )}

      {/* 安全庫存設定 */}
      {mode === 'safety' && (
        <form onSubmit={handleSafety} className="border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-600 mb-3">
            當庫存量 ≤ 安全庫存時顯示低庫存警示
          </p>
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">安全庫存量 ({unit})</label>
              <input
                type="number"
                min="0"
                value={newSafety}
                onChange={e => setNewSafety(e.target.value)}
                className={`${inp} w-32`}
              />
            </div>
            <button type="submit" disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? '儲存中...' : '儲存'}
            </button>
            <button type="button" onClick={() => setMode('none')}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
              取消
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
