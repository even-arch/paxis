'use client'

import { useEffect, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

type ChargeItem = {
  id?: number
  name: string
  calcType: 'PERCENT' | 'FLAT'
  calcBase: 'PRODUCT_SUBTOTAL' | 'GRAND_TOTAL' | 'FLAT'
  rate: number
  currency?: string
  accountCategory: string
  sortOrder: number
}

type ChargeTemplate = {
  id: number
  name: string
  description?: string
  items: ChargeItem[]
}

const ACCOUNT_CATEGORIES = [
  { value: 'HANDLING',      label: '手續費 / 操作費' },
  { value: 'FREIGHT',       label: '運費' },
  { value: 'SERVICE_FEE',   label: '服務費' },
  { value: 'TAX_OUTPUT',    label: '銷項稅額（如 VAT）' },
  { value: 'TAX_INPUT',     label: '進項稅額（如營業稅）' },
  { value: 'SALES_REVENUE', label: '銷貨收入加項' },
  { value: 'OTHER',         label: '其他' },
]

const EMPTY_ITEM = (): ChargeItem => ({
  name: '', calcType: 'PERCENT', calcBase: 'PRODUCT_SUBTOTAL',
  rate: 0, currency: undefined, accountCategory: 'HANDLING', sortOrder: 0,
})

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ChargeTemplatesPage() {
  const [templates, setTemplates] = useState<ChargeTemplate[]>([])
  const [editing, setEditing] = useState<ChargeTemplate | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/charge-templates').then(r => r.json()).then(setTemplates)
  }, [])

  const openNew = () => {
    setEditing({ id: 0, name: '', description: '', items: [EMPTY_ITEM()] })
    setIsNew(true)
  }

  const openEdit = (t: ChargeTemplate) => {
    setEditing(JSON.parse(JSON.stringify(t)))
    setIsNew(false)
  }

  const save = async () => {
    if (!editing) return
    setSaving(true)
    const res = await fetch(
      isNew ? '/api/charge-templates' : `/api/charge-templates/${editing.id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editing.name, description: editing.description, items: editing.items }),
      }
    )
    const saved = await res.json() as ChargeTemplate
    setTemplates(prev => isNew ? [saved, ...prev] : prev.map(t => t.id === saved.id ? saved : t))
    setEditing(null)
    setSaving(false)
  }

  const del = async (id: number) => {
    if (!confirm('確定要刪除此費用模板？')) return
    await fetch(`/api/charge-templates/${id}`, { method: 'DELETE' })
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const updateItem = (idx: number, patch: Partial<ChargeItem>) => {
    if (!editing) return
    const items = [...editing.items]
    items[idx] = { ...items[idx], ...patch }
    setEditing({ ...editing, items })
  }

  const addItem = () => {
    if (!editing) return
    setEditing({ ...editing, items: [...editing.items, { ...EMPTY_ITEM(), sortOrder: editing.items.length }] })
  }

  const removeItem = (idx: number) => {
    if (!editing) return
    setEditing({ ...editing, items: editing.items.filter((_, i) => i !== idx) })
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">費用模板</h1>
          <p className="text-sm text-gray-500 mt-0.5">定義附加費用規則，可指定給客戶或供應商，列印時自動帶入計算</p>
        </div>
        <button onClick={openNew}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          + 新增模板
        </button>
      </div>

      {/* 模板列表 */}
      {templates.length === 0 ? (
        <p className="text-gray-400 text-sm">尚未建立任何費用模板</p>
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-800">{t.name}</p>
                  {t.description && <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>}
                  <div className="mt-2 space-y-1">
                    {t.items.map((item, i) => (
                      <div key={i} className="text-xs text-gray-600 flex gap-3">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-gray-400">
                          {item.calcType === 'PERCENT'
                            ? `${item.rate}% × ${item.calcBase === 'PRODUCT_SUBTOTAL' ? '商品小計' : '合計'}`
                            : `固定 ${item.rate} ${item.currency || ''}`}
                        </span>
                        <span className="text-indigo-500">
                          {ACCOUNT_CATEGORIES.find(c => c.value === item.accountCategory)?.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-4">
                  <button onClick={() => openEdit(t)}
                    className="text-sm text-blue-600 hover:text-blue-800">編輯</button>
                  <button onClick={() => del(t.id)}
                    className="text-sm text-red-500 hover:text-red-700">刪除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 編輯 Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">{isNew ? '新增費用模板' : '編輯費用模板'}</h2>

              <div className="space-y-3 mb-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">模板名稱 *</label>
                  <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="例：Point Helmig 標準費用" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">說明（選填）</label>
                  <input value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="用於哪些客戶或場合的備注" />
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">費用項目</span>
                  <button onClick={addItem}
                    className="text-sm text-blue-600 hover:text-blue-800">+ 新增項目</button>
                </div>

                {editing.items.length === 0 && (
                  <p className="text-sm text-gray-400">尚未新增任何費用項目</p>
                )}

                <div className="space-y-3">
                  {editing.items.map((item, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <div className="flex gap-2">
                        <input value={item.name} onChange={e => updateItem(idx, { name: e.target.value })}
                          placeholder="費用名稱（如 PLUS HANDLING CHARGE）"
                          className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        <button onClick={() => removeItem(idx)}
                          className="text-red-400 hover:text-red-600 text-sm px-2">✕</button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">計算方式</label>
                          <select value={item.calcType} onChange={e => updateItem(idx, { calcType: e.target.value as 'PERCENT' | 'FLAT' })}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
                            <option value="PERCENT">百分比 %</option>
                            <option value="FLAT">固定金額</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            {item.calcType === 'PERCENT' ? '比率 (%)' : '金額'}
                          </label>
                          <input type="number" value={item.rate} step="0.01"
                            onChange={e => updateItem(idx, { rate: parseFloat(e.target.value) || 0 })}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">計算基準</label>
                          <select value={item.calcBase}
                            onChange={e => updateItem(idx, { calcBase: e.target.value as ChargeItem['calcBase'] })}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                            disabled={item.calcType === 'FLAT'}>
                            <option value="PRODUCT_SUBTOTAL">商品小計</option>
                            <option value="GRAND_TOTAL">含前項附加費合計</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">科目分類</label>
                          <select value={item.accountCategory}
                            onChange={e => updateItem(idx, { accountCategory: e.target.value })}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
                            {ACCOUNT_CATEGORIES.map(c => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        </div>
                        {item.calcType === 'FLAT' && (
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">幣別</label>
                            <input value={item.currency || ''} onChange={e => updateItem(idx, { currency: e.target.value })}
                              placeholder="TWD / USD…"
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button onClick={() => setEditing(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
                <button onClick={save} disabled={saving || !editing.name.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                  {saving ? '儲存中…' : '儲存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
