'use client'

import { useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useOrgPath } from '@/lib/use-org-path'

interface ParsedItem {
  sku: string | null
  name: string
  specification?: string | null
  qty: number
  unitPrice: number
  unit: string
}

interface ParsedPI {
  piNo?: string | null
  issueDate?: string | null
  estimatedShipDate?: string | null
  currency?: string | null
  paymentTerms?: string | null
  items: ParsedItem[]
  notes?: string | null
}

// 每個解析品項對應的訂單品項 mapping
interface ItemMapping {
  parsedIdx: number
  slsItemId: number | null  // null = 跳過不匯入
  quantity: number
}

interface OrderItem {
  id: number
  quantity: number
  shippedQty: number
  unitPrice: string
  unit: string | null
  product: { id: number; name: string; sku: string | null; unit: string | null }
}

export default function PIImportPage() {
  const params = useParams()
  const orderId = Number(params.id)
  const router = useRouter()
  const toOrgPath = useOrgPath()

  const fileRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')

  const [parsed, setParsed] = useState<ParsedPI | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [mappings, setMappings] = useState<ItemMapping[]>([])

  // 可編輯的 PI 號和出貨日
  const [piNo, setPiNo] = useState('')
  const [estimatedShipDate, setEstimatedShipDate] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // ── Step 1: 上傳並解析 ──────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setParsing(true)
    setParseError('')
    setParsed(null)

    try {
      // 1a. 解析 PI 文件
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/ai/parse-pi', { method: 'POST', body: form })
      const json = await res.json() as { ok?: boolean; data?: ParsedPI; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? '解析失敗')

      const data = json.data
      setParsed(data)
      setPiNo(data.piNo ?? '')
      setEstimatedShipDate(data.estimatedShipDate ?? '')

      // 1b. 取得此訂單的品項（for mapping）
      const orderRes = await fetch(`/api/sales/${orderId}`)
      const orderJson = await orderRes.json() as { items?: OrderItem[] }
      const oItems: OrderItem[] = orderJson.items ?? []
      setOrderItems(oItems)

      // 1c. 嘗試用 SKU 自動 mapping
      const auto: ItemMapping[] = data.items.map((pi, idx) => {
        const matched = oItems.find(
          oi => oi.product.sku && pi.sku && oi.product.sku.trim().toLowerCase() === pi.sku.trim().toLowerCase()
        )
        return {
          parsedIdx: idx,
          slsItemId: matched?.id ?? null,
          quantity: pi.qty,
        }
      })
      setMappings(auto)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err))
    } finally {
      setParsing(false)
    }
  }

  function updateMapping(parsedIdx: number, slsItemId: number | null) {
    setMappings(m => m.map(x => x.parsedIdx === parsedIdx ? { ...x, slsItemId } : x))
  }

  function updateQty(parsedIdx: number, qty: number) {
    setMappings(m => m.map(x => x.parsedIdx === parsedIdx ? { ...x, quantity: qty } : x))
  }

  // ── Step 2: 確認建立 PI ────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setSaveError('')

    const activeItems = mappings.filter(m => m.slsItemId !== null && m.quantity > 0)
    if (activeItems.length === 0) {
      setSaveError('至少需要一個對應到訂單品項的項目')
      setSaving(false)
      return
    }

    try {
      const res = await fetch(`/api/sales/${orderId}/pi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          piNo: piNo.trim() || null,
          estimatedShipDate: estimatedShipDate || null,
          source: 'AI_IMPORT',
          items: activeItems.map(m => ({ slsItemId: m.slsItemId!, quantity: m.quantity })),
        }),
      })
      const json = await res.json() as { piNo?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? '建立失敗')
      router.push(toOrgPath(`/sales/${orderId}`))
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href={toOrgPath(`/sales/${orderId}`)}
            className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-block">
            ← 客戶訂單
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">匯入 PI 文件</h1>
          <p className="text-sm text-gray-500 mt-0.5">上傳已發出的 PI PDF，AI 解析後確認品項對應，建立 PI 紀錄並預留庫存</p>
        </div>
        <Link href={toOrgPath(`/sales/${orderId}`)}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50">
          改用手動建立
        </Link>
      </div>

      {/* 上傳區 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">上傳 PI 文件</label>
        <div
          className="border-2 border-dashed border-indigo-300 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <div className="text-3xl mb-2">📄</div>
          <p className="text-sm font-medium text-indigo-700">點擊上傳 PI 文件</p>
          <p className="text-xs text-gray-400 mt-1">支援 PDF（Vision 解析）、Excel、CSV</p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv,image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
        {parsing && (
          <div className="mt-4 flex items-center gap-2 text-sm text-indigo-600">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            AI 正在解析文件…（PDF 會先轉圖片，需要稍等）
          </div>
        )}
        {parseError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {parseError}
          </div>
        )}
      </div>

      {/* 解析結果 */}
      {parsed && (
        <form onSubmit={handleSubmit}>
          {/* PI 基本資料 */}
          <div className="bg-white rounded-lg shadow p-6 mb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">PI 基本資料</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">PI 號碼</label>
                <input
                  type="text"
                  value={piNo}
                  onChange={e => setPiNo(e.target.value)}
                  placeholder="（AI 未識別，手動輸入）"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-400 mt-1">保留文件原始號碼，空白則自動產生</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">預計出貨日</label>
                <input
                  type="date"
                  value={estimatedShipDate}
                  onChange={e => setEstimatedShipDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {parsed.currency && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">幣別</label>
                  <span className="text-sm text-gray-800">{parsed.currency}</span>
                </div>
              )}
              {parsed.paymentTerms && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">付款條件</label>
                  <span className="text-sm text-gray-800">{parsed.paymentTerms}</span>
                </div>
              )}
            </div>
          </div>

          {/* 品項對應 */}
          <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">品項對應</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                AI 已嘗試用 SKU 自動對應。請確認每個解析品項對應到正確的訂單品項，選「跳過」可略去該行。
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {parsed.items.map((pItem, idx) => {
                const mapping = mappings[idx]
                const matchedOrder = orderItems.find(oi => oi.id === mapping?.slsItemId)
                const skuMatched = mapping?.slsItemId !== null

                return (
                  <div key={idx} className={`px-6 py-4 ${!skuMatched ? 'bg-amber-50' : ''}`}>
                    {/* 解析出來的品項資訊 */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800 text-sm">{pItem.name}</span>
                          {pItem.sku && (
                            <span className="font-mono text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              {pItem.sku}
                            </span>
                          )}
                          {skuMatched
                            ? <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">✓ 自動對應</span>
                            : <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">⚠ 需手動對應</span>
                          }
                        </div>
                        {pItem.specification && (
                          <p className="text-xs text-gray-500 mt-0.5">{pItem.specification}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {pItem.qty.toLocaleString()} {pItem.unit}　單價 {pItem.unitPrice}
                        </p>
                      </div>
                    </div>

                    {/* 對應選擇 */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">對應到訂單品項</label>
                        <select
                          value={mapping?.slsItemId ?? ''}
                          onChange={e => updateMapping(idx, e.target.value === '' ? null : Number(e.target.value))}
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">— 跳過此行 —</option>
                          {orderItems.map(oi => (
                            <option key={oi.id} value={oi.id}>
                              {oi.product.name}
                              {oi.product.sku ? ` (${oi.product.sku})` : ''}
                              　訂單 {oi.quantity} {oi.unit ?? oi.product.unit ?? 'PCS'}
                            </option>
                          ))}
                        </select>
                      </div>
                      {mapping?.slsItemId !== null && (
                        <div className="w-28">
                          <label className="block text-xs text-gray-500 mb-1">本次 PI 數量</label>
                          <input
                            type="number"
                            min="1"
                            value={mapping?.quantity ?? pItem.qty}
                            onChange={e => updateQty(idx, Number(e.target.value))}
                            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* 確認後對應的訂單品項詳情 */}
                    {matchedOrder && (
                      <div className="mt-2 text-xs text-gray-400 pl-1">
                        → 對應：{matchedOrder.product.name}
                        {matchedOrder.product.sku ? ` (${matchedOrder.product.sku})` : ''}，
                        訂單 {matchedOrder.quantity}，已出貨 {matchedOrder.shippedQty}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {saveError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {saveError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-purple-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? '建立中…' : '✓ 確認建立 PI，預留庫存'}
            </button>
            <Link
              href={toOrgPath(`/sales/${orderId}`)}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
            >
              取消
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
