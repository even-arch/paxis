'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SortableHeader from '@/components/SortableHeader'
import { useOrgPath } from '@/lib/use-org-path'

export type ProductRow = {
  id: number
  name: string
  sku: string | null
  modelNo: string | null
  unit: string | null
  isArchived: boolean
  stock: number
  createdAt: string
}

type Props = {
  products: ProductRow[]
  total: number
  page: number
  totalPages: number
  search: string
  supplierId: number | null
  customerId: number | null
  archived: boolean
  filterSupplierName?: string
  filterCustomerName?: string
  suppliers: { id: number; label: string }[]
  customers: { id: number; label: string }[]
  sort?: string
  dir?: 'asc' | 'desc'
}

export default function ProductsClient({
  products, total, page, totalPages,
  search, supplierId, customerId, archived,
  filterSupplierName, filterCustomerName,
  suppliers, customers,
  sort = 'sku', dir = 'asc',
}: Props) {
  const router = useRouter()
  const toOrgPath = useOrgPath()
  const fileRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [working, setWorking] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [showExcelImportResult, setShowExcelImportResult] = useState<null | { updated: number; skipped: number; results: { sku: string; name: string; action: string; changes?: string[]; reason?: string }[] }>(null)
  const [enriching, setEnriching] = useState(false)
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null)
  const [enrichProgress, setEnrichProgress] = useState<{ done: number; total: number } | null>(null)

  const allIds = products.map(p => p.id)
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id))

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(allIds))
  }

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function buildUrl(overrides: Record<string, string | number | null>) {
    const params = new URLSearchParams()
    if ((overrides.search ?? search)) params.set('search', String(overrides.search ?? search))
    if (Number(overrides.page ?? page) > 1) params.set('page', String(overrides.page ?? page))
    const sid = 'supplierId' in overrides ? overrides.supplierId : supplierId
    if (sid) params.set('supplierId', String(sid))
    const cid = 'customerId' in overrides ? overrides.customerId : customerId
    if (cid) params.set('customerId', String(cid))
    if (overrides.archived ?? archived) params.set('archived', 'true')
    const s = (overrides.sort as string | undefined) ?? sort
    const d = (overrides.dir as string | undefined) ?? dir
    params.set('sort', s)
    params.set('dir', d)
    return toOrgPath(`/products?${params.toString()}`)
  }

  function buildSortUrl(newSort: string, newDir: 'asc' | 'desc') {
    return buildUrl({ sort: newSort, dir: newDir, page: 1 })
  }

  async function handleBatch(action: 'archive' | 'unarchive') {
    if (!selected.size) return
    setWorking(true)
    await fetch('/api/products/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected), action }),
    })
    setSelected(new Set())
    setWorking(false)
    router.refresh()
  }

  async function handleDelete() {
    setDeleteError('')
    setWorking(true)
    const res = await fetch('/api/products/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected), action: 'delete', password: deletePassword }),
    })
    setWorking(false)
    if (res.ok) {
      setShowDeleteModal(false)
      setDeletePassword('')
      setSelected(new Set())
      router.refresh()
    } else {
      const err = await res.json()
      setDeleteError(err.error ?? '刪除失敗')
    }
  }

  async function handleEnrich() {
    setEnriching(true); setEnrichMsg(null); setEnrichProgress(null)
    try {
      const preview = await fetch('/api/admin/re-enrich').then(r => r.json())
      if (preview.error) {
        setEnrichMsg(`錯誤：${preview.error}`)
        setEnriching(false)
        return
      }
      const total = (preview.needName ?? 0) + (preview.needHts ?? 0)
      if (total === 0) {
        setEnrichMsg(`不需要豐富化（共 ${preview.total ?? 0} 筆商品，${preview.noSpec ?? 0} 筆無規格）`)
        setEnriching(false)
        return
      }
      let done = 0; let offset = 0
      const batchSize = 5
      while (true) {
        const res = await fetch(`/api/admin/re-enrich?batch=${batchSize}&offset=${offset}`, { method: 'POST' })
        const data = await res.json()
        if (!data.ok) { setEnrichMsg(`豐富化失敗：${data.error ?? '未知錯誤'}`); break }
        done += data.changed ?? 0
        offset += batchSize
        setEnrichProgress({ done, total })
        if (!data.hasMore) {
          setEnrichMsg(`AI 豐富化完成：${done} 筆商品已更新`)
          break
        }
      }
    } catch (e) {
      setEnrichMsg(`錯誤：${e instanceof Error ? e.message : String(e)}`)
    }
    setEnriching(false)
    router.refresh()
  }

  function handleExport() {
    const ids = selected.size > 0 ? Array.from(selected) : []
    const params = new URLSearchParams()
    if (ids.length) params.set('ids', ids.join(','))
    if (archived) params.set('archived', 'true')
    window.open(`/api/products/export?${params.toString()}`, '_blank')
  }

  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setWorking(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/products/excel-import', { method: 'POST', body: fd })
    const data = await res.json()
    setWorking(false)
    if (res.ok) {
      setShowExcelImportResult(data)
      router.refresh()
    } else {
      alert(data.error ?? '匯入失敗')
    }
  }

  const pageBase = buildUrl({})

  return (
    <div>
      {/* 標題列 */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800">商品管理</h1>
        <div className="flex gap-2 flex-wrap">
          {/* 封存/現有切換 */}
          <a href={archived ? toOrgPath('/products') : toOrgPath('/products?archived=true')}
            className={`px-3 py-2 rounded-md text-sm font-medium border ${archived
              ? 'bg-amber-100 border-amber-300 text-amber-800'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {archived ? '查看現有產品' : '查看封存產品'}
          </a>
          <button onClick={handleEnrich} disabled={enriching || working}
            className="border border-purple-300 text-purple-700 bg-purple-50 px-3 py-2 rounded-md text-sm font-medium hover:bg-purple-100 disabled:opacity-50">
            {enriching
              ? (enrichProgress ? `✨ 豐富化 ${enrichProgress.done}/${enrichProgress.total}` : '✨ 查詢中...')
              : '✨ AI 豐富化'}
          </button>
          <button onClick={handleExport}
            className="border border-green-300 text-green-700 bg-green-50 px-3 py-2 rounded-md text-sm font-medium hover:bg-green-100">
            ↓ 匯出 Excel{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={working}
            className="border border-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
            ↑ Excel 更新
          </button>
          <input ref={fileRef} type="file" className="hidden"
            accept=".xlsx,.xls" onChange={handleExcelImport} />
          {!archived && (
            <a href={toOrgPath('/products/new')}
              className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
              + 新增商品
            </a>
          )}
        </div>
      </div>

      {/* 供應商/客戶過濾提示 */}
      {(filterSupplierName || filterCustomerName) && (
        <div className="mb-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm">
          {filterSupplierName && <span className="text-blue-700">供應商：<strong>{filterSupplierName}</strong></span>}
          {filterCustomerName && <span className="text-blue-700">客戶：<strong>{filterCustomerName}</strong></span>}
          <a href={buildUrl({ supplierId: null, customerId: null, page: 1 })} className="ml-auto text-xs text-blue-500 hover:underline">清除篩選</a>
        </div>
      )}

      {/* 封存模式提示 */}
      {archived && (
        <div className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm">
          <span className="text-amber-700">目前顯示封存產品</span>
        </div>
      )}

      {/* AI 豐富化結果 */}
      {enrichMsg && (
        <div className="mb-4 flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 text-sm text-purple-700">
          <span>{enrichMsg}</span>
          <button onClick={() => setEnrichMsg(null)} className="text-purple-400 hover:text-purple-600 ml-4">×</button>
        </div>
      )}

      {/* Excel 匯入結果 */}
      {showExcelImportResult && (
        <div className="mb-4 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">
              Excel 更新完成：更新 {showExcelImportResult.updated} 筆，略過 {showExcelImportResult.skipped} 筆
            </span>
            <button onClick={() => setShowExcelImportResult(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
          </div>
          <div className="max-h-40 overflow-y-auto text-xs space-y-1">
            {showExcelImportResult.results.filter(r => r.action === 'updated').map((r, i) => (
              <div key={i} className="text-green-700">✓ {r.sku} {r.name} — 更新欄位：{r.changes?.join(', ')}</div>
            ))}
            {showExcelImportResult.results.filter(r => r.action === 'skipped' && r.reason !== '無變更').map((r, i) => (
              <div key={i} className="text-amber-600">⚠ {r.sku} — {r.reason}</div>
            ))}
          </div>
        </div>
      )}

      {/* 批次操作工具列 */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <span className="text-sm text-blue-700 font-medium">已選 {selected.size} 項</span>
          <div className="ml-auto flex gap-2">
            {!archived && (
              <button onClick={() => handleBatch('archive')} disabled={working}
                className="text-xs px-3 py-1.5 border border-amber-300 text-amber-700 bg-amber-50 rounded hover:bg-amber-100 disabled:opacity-50">
                封存
              </button>
            )}
            {archived && (
              <button onClick={() => handleBatch('unarchive')} disabled={working}
                className="text-xs px-3 py-1.5 border border-green-300 text-green-700 bg-green-50 rounded hover:bg-green-100 disabled:opacity-50">
                取消封存
              </button>
            )}
            <button onClick={() => setShowDeleteModal(true)} disabled={working}
              className="text-xs px-3 py-1.5 border border-red-300 text-red-700 bg-red-50 rounded hover:bg-red-100 disabled:opacity-50">
              刪除
            </button>
            <button onClick={() => setSelected(new Set())}
              className="text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded hover:bg-gray-50">
              取消選取
            </button>
          </div>
        </div>
      )}

      {/* 搜尋列 */}
      <form method="GET" className="mb-4 flex gap-2 flex-wrap">
        {archived && <input type="hidden" name="archived" value="true" />}
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <input name="search" defaultValue={search}
          placeholder="搜尋商品名稱、SKU、型號..."
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select name="supplierId" defaultValue={supplierId ?? ''}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">全部供應商</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select name="customerId" defaultValue={customerId ?? ''}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">全部客戶</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <button type="submit" className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-200">
          搜尋
        </button>
        {(search || supplierId || customerId) && (
          <a href={buildUrl({ search: '', supplierId: null, customerId: null, page: 1 })}
            className="border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50 text-gray-500">
            清除
          </a>
        )}
      </form>

      {/* 表格 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 w-8">
                <input type="checkbox" checked={allSelected} onChange={toggleAll}
                  className="rounded border-gray-300" />
              </th>
              <SortableHeader label="商品名稱" field="name" sort={sort} dir={dir} buildUrl={buildSortUrl} />
              <SortableHeader label="SKU" field="sku" sort={sort} dir={dir} buildUrl={buildSortUrl} />
              <SortableHeader label="型號" field="modelNo" sort={sort} dir={dir} buildUrl={buildSortUrl} />
              <SortableHeader label="單位" field="unit" sort={sort} dir={dir} buildUrl={buildSortUrl} />
              <SortableHeader label="庫存" field="stock" sort={sort} dir={dir} buildUrl={buildSortUrl} align="right" />
              <SortableHeader label="建立日期" field="createdAt" sort={sort} dir={dir} buildUrl={buildSortUrl} />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">
                  {search ? `找不到「${search}」相關商品` : archived ? '無封存商品' : '尚無商品，請新增'}
                </td>
              </tr>
            )}
            {products.map(p => (
              <tr key={p.id} className={`hover:bg-gray-50 ${selected.has(p.id) ? 'bg-blue-50' : ''}`}>
                <td className="px-3 py-3">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
                    className="rounded border-gray-300" />
                </td>
                <td className="px-4 py-3">
                  <Link href={toOrgPath(`/products/${p.id}`)} className="font-medium text-blue-600 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.sku ?? '-'}</td>
                <td className="px-4 py-3 text-gray-500">{p.modelNo ?? '-'}</td>
                <td className="px-4 py-3 text-gray-500">{p.unit ?? '-'}</td>
                <td className="px-4 py-3 text-right">{p.stock}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{p.createdAt}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={toOrgPath(`/products/${p.id}/edit`)} className="text-gray-400 hover:text-blue-600 text-xs">編輯</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分頁 */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm">
          <span className="text-gray-500">共 {total} 筆</span>
          <div className="flex gap-1 ml-auto">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <a key={p} href={buildUrl({ page: p })}
                className={`px-3 py-1 rounded-md ${p === page ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                {p}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 刪除確認 Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-red-500 text-2xl">⚠</span>
              <h3 className="text-base font-semibold">確認刪除 {selected.size} 項產品</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              刪除後所有歷史記錄將一併消失且無法復原。請輸入您的登入密碼以確認執行。
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">登入密碼</label>
              <input
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDelete()}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="輸入密碼..."
                autoFocus
              />
              {deleteError && <p className="text-xs text-red-600 mt-1">{deleteError}</p>}
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError('') }}
                className="text-sm px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                取消
              </button>
              <button onClick={handleDelete} disabled={!deletePassword || working}
                className="text-sm px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
                {working ? '刪除中...' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
