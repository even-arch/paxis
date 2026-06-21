'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type POResult = { id: number; poNo: string; supplierId: number; supplier: { name: string; shortName: string | null }; totalAmount: string | null; currencyCode: string }

export default function LinkPOButton({ piId, linkedPOIds }: { piId: number; linkedPOIds: number[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<POResult[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    if (!open) return
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!query.trim()) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/purchases?search=${encodeURIComponent(query)}&limit=20`)
        const data = await res.json()
        setResults((data.orders ?? data ?? []).filter((po: POResult) => !linkedPOIds.includes(po.id)))
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query, open])

  async function linkPO(poId: number) {
    setSaving(true)
    await fetch(`/api/purchases/${poId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slsPiId: piId }),
    })
    setSaving(false)
    setOpen(false)
    setQuery('')
    setResults([])
    router.refresh()
  }

  return (
    <div className="relative inline-block">
      {!open ? (
        <button onClick={() => setOpen(true)}
          className="text-xs px-2 py-1 rounded border border-orange-300 text-orange-700 hover:bg-orange-50">
          ＋ 連結採購單（PO）
        </button>
      ) : (
        <div className="absolute z-20 top-0 left-0 bg-white border border-gray-300 rounded-lg shadow-lg w-80">
          <div className="flex items-center gap-2 p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="輸入 PO 號或供應商名稱..."
              className="flex-1 text-sm px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button onClick={() => { setOpen(false); setQuery(''); setResults([]) }}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading && <div className="text-xs text-gray-400 px-3 py-2">搜尋中...</div>}
            {!loading && query && results.length === 0 && (
              <div className="text-xs text-gray-400 px-3 py-3">找不到符合的採購單</div>
            )}
            {!loading && !query && (
              <div className="text-xs text-gray-400 px-3 py-3">輸入 PO 號或供應商名稱搜尋</div>
            )}
            {results.map(po => (
              <button key={po.id} onClick={() => !saving && linkPO(po.id)} disabled={saving}
                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0 disabled:opacity-50">
                <div className="font-mono text-sm font-medium text-gray-800">{po.poNo}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {po.supplier.shortName ?? po.supplier.name}
                  {po.totalAmount && <span className="ml-2 text-gray-400">{po.currencyCode} {Number(po.totalAmount).toLocaleString()}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
