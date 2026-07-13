'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { orgPath } from '@/lib/org-path'

// ─── 型別 ────────────────────────────────────────────────────────

type SupplierOption = { id: number; name: string; shortName: string | null }

type BomItemRow = {
  componentId: number
  name: string
  sku: string | null
  productType: number
  unit: string | null
  qtyPer: string
  scrapRate: string
  preferredSupplierId: number | null
  supplierOptions: SupplierOption[]
  note: string
}

type BomTreeNode = {
  productId: number
  name: string
  sku: string | null
  productType: number
  unit: string | null
  qtyPer: string
  scrapRate: string | null
  preferredSupplier: SupplierOption | null
  isCircular: boolean
  children: BomTreeNode[]
}

type SearchResult = { id: number; name: string; sku: string | null; unit: string | null }

type Props = {
  productId: number
  productName: string
  productUnit: string | null
  orgSlug: string
}

const TYPE_BADGE: Record<number, { text: string; cls: string }> = {
  0: { text: '成品',   cls: 'bg-blue-50 text-blue-600' },
  1: { text: '半成品', cls: 'bg-purple-50 text-purple-600' },
  2: { text: '原料',   cls: 'bg-gray-100 text-gray-500' },
}

// ─── 主元件 ──────────────────────────────────────────────────────

export default function BomEditor({ productId, productName, productUnit, orgSlug }: Props) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<BomItemRow[]>([])
  const [tree, setTree] = useState<BomTreeNode[]>([])
  const [version, setVersion] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/products/${productId}/bom`)
    if (!res.ok) { setError('載入失敗'); setLoading(false); return }
    const data = await res.json()
    if (data.header) {
      setVersion(data.header.version)
      setItems(data.header.items.map((i: {
        componentId: number
        component: { name: string; sku: string | null; productType: number; unit: string | null; supplierProducts: { supplier: SupplierOption }[] }
        qtyPer: string
        scrapRate: string | null
        preferredSupplierId: number | null
        note: string | null
      }) => ({
        componentId: i.componentId,
        name: i.component.name,
        sku: i.component.sku,
        productType: i.component.productType,
        unit: i.component.unit,
        qtyPer: i.qtyPer,
        scrapRate: i.scrapRate ?? '',
        preferredSupplierId: i.preferredSupplierId,
        supplierOptions: i.component.supplierProducts.map(sp => sp.supplier),
        note: i.note ?? '',
      })))
    } else {
      setVersion(null)
      setItems([])
    }
    setTree(data.tree ?? [])
    setDirty(false)
    setLoading(false)
  }, [productId])

  useEffect(() => { load() }, [load])

  function updateItem(idx: number, patch: Partial<BomItemRow>) {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
    setDirty(true)
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }

  async function addComponent(p: SearchResult) {
    if (p.id === productId) { setError('零件不能是產品自己'); return }
    if (items.some(it => it.componentId === p.id)) { setError('此零件已在清單中'); return }
    setError('')
    // 抓該零件的供應商清單供下拉選擇
    let supplierOptions: SupplierOption[] = []
    let productType = 2
    try {
      const res = await fetch(`/api/products/${p.id}`)
      if (res.ok) {
        const detail = await res.json()
        productType = detail.productType ?? 2
        supplierOptions = (detail.supplierProducts ?? []).map(
          (sp: { supplier: SupplierOption }) => sp.supplier
        )
      }
    } catch { /* 拿不到供應商就留空 */ }
    setItems(prev => [...prev, {
      componentId: p.id,
      name: p.name,
      sku: p.sku,
      productType,
      unit: p.unit,
      qtyPer: '1',
      scrapRate: '',
      preferredSupplierId: null,
      supplierOptions,
      note: '',
    }])
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/products/${productId}/bom`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(it => ({
            componentId: it.componentId,
            qtyPer: it.qtyPer,
            scrapRate: it.scrapRate || null,
            preferredSupplierId: it.preferredSupplierId,
            note: it.note || null,
          })),
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? '儲存失敗')
        return
      }
      await load()
    } catch {
      setError('網路錯誤，請重試')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-400">載入中…</p>

  return (
    <div className="space-y-6">
      {/* ── 零件清單（編輯） ── */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">零件清單</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              每 1 {productUnit ?? '單位'} {productName} 的用料
              {version != null && <span className="ml-2 text-gray-300">· 版本 {version}</span>}
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-40"
          >
            {saving ? '儲存中…' : dirty ? '儲存 BOM' : '已儲存'}
          </button>
        </div>

        <div className="p-5">
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 mb-4">尚未設定零件。搜尋下方欄位加入第一筆。</p>
          ) : (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">零件</th>
                    <th className="pb-2 font-medium w-28 text-right">用量</th>
                    <th className="pb-2 font-medium w-24 text-right">損耗率 %</th>
                    <th className="pb-2 font-medium w-44">指定供應商</th>
                    <th className="pb-2 font-medium w-32">備註</th>
                    <th className="pb-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item, idx) => {
                    const badge = TYPE_BADGE[item.productType] ?? TYPE_BADGE[2]
                    return (
                      <tr key={item.componentId}>
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${badge.cls}`}>{badge.text}</span>
                            <div className="min-w-0">
                              <Link href={orgPath(orgSlug, `/products/${item.componentId}`)} className="text-blue-600 hover:underline block truncate">
                                {item.name}
                              </Link>
                              {item.sku && <span className="text-xs text-gray-400 font-mono">{item.sku}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-1 justify-end">
                            <input
                              type="number" min="0" step="0.0001"
                              value={item.qtyPer}
                              onChange={e => updateItem(idx, { qtyPer: e.target.value })}
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-400 w-8">{item.unit ?? ''}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number" min="0" max="100" step="0.1"
                            value={item.scrapRate}
                            onChange={e => updateItem(idx, { scrapRate: e.target.value })}
                            placeholder="—"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            value={item.preferredSupplierId ?? ''}
                            onChange={e => updateItem(idx, { preferredSupplierId: e.target.value ? Number(e.target.value) : null })}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">依主要供應商</option>
                            {item.supplierOptions.map(s => (
                              <option key={s.id} value={s.id}>{s.shortName ?? s.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            value={item.note}
                            onChange={e => updateItem(idx, { note: e.target.value })}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => removeItem(idx)}
                            className="text-gray-300 hover:text-red-500 text-lg leading-none"
                            title="移除"
                          >×</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <ComponentSearch onSelect={addComponent} excludeIds={[productId, ...items.map(i => i.componentId)]} />
          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        </div>
      </div>

      {/* ── 多階展開（唯讀） ── */}
      {tree.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">多階展開</h2>
            <p className="text-xs text-gray-400 mt-0.5">半成品的 BOM 逐層往下展開；用量為相對上一層</p>
          </div>
          <div className="p-5">
            <TreeView nodes={tree} orgSlug={orgSlug} depth={0} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 零件搜尋 ────────────────────────────────────────────────────

function ComponentSearch({ onSelect, excludeIds }: {
  onSelect: (p: SearchResult) => void
  excludeIds: number[]
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(v: string) {
    setQuery(v)
    if (timer.current) clearTimeout(timer.current)
    if (!v.trim()) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/products?search=${encodeURIComponent(v.trim())}&limit=10`)
      if (!res.ok) return
      const data = await res.json() as { products: SearchResult[] }
      setResults(data.products.filter(p => !excludeIds.includes(p.id)))
      setOpen(true)
    }, 300)
  }

  return (
    <div className="relative max-w-md">
      <input
        type="text"
        value={query}
        onChange={e => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        placeholder="搜尋零件（名稱 / SKU / 型號）加入清單…"
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p); setQuery(''); setResults([]); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0"
            >
              <span className="text-gray-800">{p.name}</span>
              {p.sku && <span className="ml-2 text-xs text-gray-400 font-mono">{p.sku}</span>}
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && query.trim() && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-sm text-gray-400">
          找不到符合的產品
        </div>
      )}
    </div>
  )
}

// ─── 多階樹狀顯示 ────────────────────────────────────────────────

function TreeView({ nodes, orgSlug, depth }: { nodes: BomTreeNode[]; orgSlug: string; depth: number }) {
  return (
    <div className={depth > 0 ? 'ml-6 border-l border-gray-100 pl-4' : ''}>
      {nodes.map(node => {
        const badge = TYPE_BADGE[node.productType] ?? TYPE_BADGE[2]
        return (
          <div key={`${node.productId}-${depth}`} className="py-1.5">
            <div className="flex items-center gap-2 text-sm">
              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${badge.cls}`}>{badge.text}</span>
              <Link href={orgPath(orgSlug, `/products/${node.productId}`)} className="text-blue-600 hover:underline">
                {node.name}
              </Link>
              {node.sku && <span className="text-xs text-gray-400 font-mono">{node.sku}</span>}
              <span className="text-gray-500 text-xs">× {node.qtyPer} {node.unit ?? ''}</span>
              {node.scrapRate && <span className="text-xs text-amber-600">損耗 {node.scrapRate}%</span>}
              {node.preferredSupplier && (
                <span className="text-xs text-gray-400">
                  ({node.preferredSupplier.shortName ?? node.preferredSupplier.name})
                </span>
              )}
              {node.isCircular && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600">⚠ 循環引用</span>
              )}
            </div>
            {node.children.length > 0 && <TreeView nodes={node.children} orgSlug={orgSlug} depth={depth + 1} />}
          </div>
        )
      })}
    </div>
  )
}
