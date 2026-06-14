'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

type OrderItem = {
  id: number
  productName: string
  sku: string | null
  customerSkuRef: string | null
}

type Props = {
  orderId: number
  customerPoNo: string | null
  items: OrderItem[]
}

type MappingResult = {
  ourSku: string | null
  customerSku: string
  saved: boolean
}

export default function CustomerPoPanel({ orderId, customerPoNo: initPoNo, items }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(!initPoNo)   // 未關聯時預設展開
  const [mode, setMode] = useState<'view' | 'manual' | 'upload'>('view')

  const [poNo, setPoNo] = useState(initPoNo ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [mappings, setMappings] = useState<MappingResult[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // 手動填入 PO 號
  async function savePoNo() {
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/sales/${orderId}/link-po`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerPoNo: poNo || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '儲存失敗')
      setMode('view')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  // 上傳 PO 文件，AI 解析 SKU mapping
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true); setError(''); setMappings(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(`/api/sales/${orderId}/link-po`, { method: 'PATCH', body: fd })
      const json = await res.json() as {
        ok?: boolean; customerPoNo?: string | null; mappings?: MappingResult[]; error?: string
      }
      if (!res.ok) throw new Error(json.error ?? '解析失敗')
      if (json.customerPoNo) setPoNo(json.customerPoNo)
      setMappings(json.mappings ?? [])
      setMode('view')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  const hasMapping = items.some(i => i.customerSkuRef)
  const currentPoNo = initPoNo || poNo

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-700">客戶採購單（PO）關聯</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {currentPoNo
              ? `客戶 PO：${currentPoNo}${hasMapping ? '　SKU 對應已記錄' : ''}`
              : '尚未關聯客戶 PO — 可上傳 PO 文件自動比對 SKU，或手動填入 PO 號'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentPoNo && !expanded && (
            <button onClick={() => setExpanded(true)}
              className="text-xs text-gray-400 hover:text-gray-600">▼ 展開</button>
          )}
          {!currentPoNo && (
            <>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
                className="hidden" onChange={handleUpload} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50">
                {uploading ? '解析中…' : '✨ 上傳 PO 自動比對'}
              </button>
              <button
                onClick={() => { setMode('manual'); setExpanded(true) }}
                className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-50">
                手動填入 PO 號
              </button>
            </>
          )}
          {currentPoNo && (
            <button
              onClick={() => { setMode('manual'); setExpanded(true) }}
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2 py-1 rounded">
              ✎ 修改
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="underline ml-3">關閉</button>
        </div>
      )}

      {/* 上傳解析結果 */}
      {mappings && (
        <div className="mx-6 mt-3 bg-indigo-50 border border-indigo-200 rounded p-3 text-xs">
          <p className="font-medium text-indigo-700 mb-2">AI 解析完成 — SKU 對應結果：</p>
          <div className="space-y-1">
            {mappings.map((m, i) => (
              <div key={i} className={`flex items-center gap-2 ${m.saved ? 'text-green-700' : 'text-amber-700'}`}>
                <span>{m.saved ? '✓' : '⚠'}</span>
                <span>客戶 SKU <span className="font-mono">{m.customerSku}</span></span>
                {m.ourSku && <><span className="text-gray-400">→</span><span>我方 <span className="font-mono">{m.ourSku}</span></span></>}
                {!m.saved && <span className="text-gray-400">（未能對應）</span>}
              </div>
            ))}
          </div>
          <button onClick={() => setMappings(null)} className="mt-2 text-indigo-600 underline">關閉</button>
        </div>
      )}

      {/* 手動填入模式 */}
      {mode === 'manual' && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">客戶 PO 號碼</label>
              <input type="text" value={poNo} onChange={e => setPoNo(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例：PO-2025-0123" />
            </div>
            <button onClick={savePoNo} disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? '儲存中…' : '✓ 儲存'}
            </button>
            <button onClick={() => setMode('view')}
              className="border border-gray-300 text-gray-600 px-4 py-2 rounded text-sm hover:bg-gray-50">
              取消
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            也可以上傳 PO 文件，讓 AI 自動解析 PO 號並比對 SKU。
            <button onClick={() => { fileRef.current?.click() }} className="text-indigo-600 underline ml-1">上傳 PO 文件</button>
          </p>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
            className="hidden" onChange={handleUpload} />
        </div>
      )}

      {/* SKU 對應表（有資料時顯示） */}
      {(expanded || currentPoNo) && hasMapping && mode === 'view' && (
        <div className="divide-y divide-gray-50">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-500">我方商品</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">我方 SKU</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">客戶 PO 上的 SKU</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(item => (
                <tr key={item.id}>
                  <td className="px-4 py-2 text-gray-700">{item.productName}</td>
                  <td className="px-4 py-2 font-mono text-gray-500">{item.sku ?? '-'}</td>
                  <td className="px-4 py-2">
                    {item.customerSkuRef
                      ? <span className="font-mono text-indigo-700">{item.customerSkuRef}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 空狀態（無 mapping 且已關聯 PO 號） */}
      {currentPoNo && !hasMapping && mode === 'view' && expanded && (
        <div className="px-6 py-4 text-xs text-gray-400">
          PO 號已記錄，但尚未解析 SKU 對應。
          <button onClick={() => fileRef.current?.click()}
            className="text-indigo-600 underline ml-2 disabled:opacity-50"
            disabled={uploading}>
            {uploading ? '解析中…' : '上傳 PO 文件解析 SKU'}
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
            className="hidden" onChange={handleUpload} />
        </div>
      )}
    </div>
  )
}
