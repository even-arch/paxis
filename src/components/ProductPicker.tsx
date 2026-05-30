'use client'
import { useState, useRef, useEffect } from 'react'

type Product = { id: number; name: string; sku: string | null; unit: string | null }

interface Props {
  products: Product[]
  value: string          // productId as string
  onChange: (id: string, unit: string) => void
  placeholder?: string
}

export default function ProductPicker({ products, value, onChange, placeholder = '搜尋產品名稱或料號…' }: Props) {
  const selected = products.find(p => String(p.id) === value)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // 點外面關閉
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = query.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 30)
    : products.slice(0, 30)

  function select(p: Product) {
    onChange(String(p.id), p.unit ?? 'PCS')
    setQuery('')
    setOpen(false)
  }

  function clear() {
    onChange('', '')
    setQuery('')
  }

  return (
    <div ref={ref} className="relative">
      {selected && !open ? (
        <div className="flex items-center gap-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white">
          <span className="flex-1 truncate">
            {selected.name}
            {selected.sku && <span className="text-gray-400 ml-1 text-xs">({selected.sku})</span>}
          </span>
          <button type="button" onClick={clear} className="text-gray-400 hover:text-gray-600 shrink-0">×</button>
        </div>
      ) : (
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">找不到符合的產品</div>
          ) : (
            filtered.map(p => (
              <button key={p.id} type="button" onMouseDown={() => select(p)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-2">
                <span className="truncate">{p.name}</span>
                {p.sku && <span className="text-xs text-gray-400 shrink-0 font-mono">{p.sku}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
