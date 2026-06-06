'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ParsedShipmentExcel } from '@/app/api/parse-shipment-excel/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchedOrder {
  id: number
  orderNo: string
  customerName: string | null
  items: Array<{ id: number; sku: string | null; quantity: number; unit: string }>
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ShipmentImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [parsed, setParsed] = useState<ParsedShipmentExcel | null>(null)

  // 訂單比對
  const [matchedOrder, setMatchedOrder] = useState<MatchedOrder | null>(null)
  const [matchError, setMatchError] = useState('')
  const [searching, setSearching] = useState(false)
  const [manualOrderNo, setManualOrderNo] = useState('')

  // 可編輯欄位
  const [actualShipDate, setActualShipDate] = useState('')
  const [shippingMethod, setShippingMethod] = useState('')
  const [portOfLoading, setPortOfLoading] = useState('')
  const [portOfDischarge, setPortOfDischarge] = useState('')
  const [trackingNo, setTrackingNo] = useState('')

  // 儲存
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedShipmentNo, setSavedShipmentNo] = useState<string | null>(null)

  // ── 上傳解析 ─────────────────────────────────────────────────────────────────

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setParsing(true); setParseError(''); setParsed(null); setMatchedOrder(null)

    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/parse-shipment-excel', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '解析失敗')
      const result: ParsedShipmentExcel = data.data
      setParsed(result)

      // 用 shipmentDate 預填實際出貨日
      if (result.shipmentDate) setActualShipDate(result.shipmentDate)
      if (result.paymentTerms) setShippingMethod(result.paymentTerms)
      if (result.origin) setPortOfLoading(result.origin)
      if (result.destination) setPortOfDischarge(result.destination)

      // 自動搜尋訂單
      if (result.orderNo) {
        setManualOrderNo(result.orderNo)
        await searchOrder(result.orderNo)
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : '解析失敗')
    } finally {
      setParsing(false)
    }
  }

  async function searchOrder(orderNo: string) {
    if (!orderNo.trim()) return
    setSearching(true); setMatchError(''); setMatchedOrder(null)
    try {
      // Step 1: 找訂單 ID
      const res = await fetch(`/api/sales?search=${encodeURIComponent(orderNo.trim())}&limit=5`)
      const data = await res.json()
      const orders = data.orders ?? []
      const found = orders.find((o: { orderNo: string }) => o.orderNo === orderNo.trim()) ?? orders[0]
      if (!found) { setMatchError(`找不到訂單「${orderNo}」`); return }

      // Step 2: 取完整品項（含 slsItemId）
      const detailRes = await fetch(`/api/sales/${found.id}`)
      const detail = await detailRes.json()
      setMatchedOrder({
        id: detail.id,
        orderNo: detail.orderNo,
        customerName: detail.customer?.name ?? detail.patiscoBuyerName ?? null,
        items: (detail.items ?? []).map((it: { id: number; product: { sku: string | null }; quantity: number; unit: string }) => ({
          id: it.id,
          sku: it.product?.sku ?? null,
          quantity: it.quantity,
          unit: it.unit,
        })),
      })
    } catch {
      setMatchError('搜尋失敗')
    } finally {
      setSearching(false)
    }
  }

  // ── 儲存到 PAXIS ──────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!parsed || !matchedOrder) return
    if (!actualShipDate) { setSaveError('請填寫實際出貨日'); return }

    setSaving(true); setSaveError('')
    try {
      // 比對 matched order 的 SLS_Items，用 SKU 對應
      const items = matchedOrder.items.map(orderItem => {
        const parsedItem = parsed.items.find(pi =>
          pi.itemNo === orderItem.sku ||
          pi.itemNo.replace(/\s/g, '') === (orderItem.sku ?? '').replace(/\s/g, '')
        )
        return {
          slsItemId: orderItem.id,
          quantity: parsedItem?.qty ?? orderItem.quantity,
          cartons: parsed.totalCartons != null
            ? Math.ceil(parsed.totalCartons / matchedOrder.items.length)
            : null,
          grossWeightKg: parsedItem?.grossWeightKg ?? null,
          netWeightKg: parsedItem?.netWeightKg ?? null,
          cbm: parsedItem?.cft != null ? parsedItem.cft : null,  // 以 ft³ 存入 cbm 欄（前端標示為 ft³）
        }
      })

      const res = await fetch(`/api/sales/${matchedOrder.id}/shipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualShipDate,
          shippingMethod: shippingMethod || null,
          portOfLoading: portOfLoading || null,
          portOfDischarge: portOfDischarge || null,
          trackingNo: trackingNo || null,
          packingListNo: parsed.packingListNo || null,
          commercialInvNo: parsed.invoiceNo || null,
          note: parsed.additionalInfo || null,
          source: 'AI_IMPORT',
          items,
        }),
      })
      const resData = await res.json()
      if (!res.ok) throw new Error(resData.error ?? '儲存失敗')
      setSavedShipmentNo(resData.shipmentNo)

      // 若有附加費用，儲存到訂單 note（暫時方案，後續有 additionalCharges 欄位後改）
      if (parsed.additionalCharges.length > 0) {
        // 已在 note 裡，不額外處理
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (savedShipmentNo) {
    return (
      <div className="max-w-lg space-y-5">
        <div className="bg-green-50 border border-green-300 rounded-xl p-6 text-center space-y-2">
          <div className="text-4xl">✅</div>
          <h2 className="text-lg font-semibold text-green-800">出貨記錄已建立</h2>
          <p className="text-sm text-gray-600">
            出貨單號：<span className="font-mono font-bold">{savedShipmentNo}</span>
          </p>
          <p className="text-xs text-gray-400">庫存已扣減，應收帳款已建立</p>
        </div>
        <div className="flex gap-3">
          <button type="button"
            onClick={() => router.push(`/sales`)}
            className="flex-1 bg-teal-600 text-white py-2 rounded-md text-sm font-medium hover:bg-teal-700">
            前往客戶訂單列表
          </button>
          <button type="button"
            onClick={() => {
              setParsed(null); setMatchedOrder(null); setSavedShipmentNo(null)
              setActualShipDate(''); setShippingMethod(''); setPortOfLoading('')
              setPortOfDischarge(''); setTrackingNo('')
            }}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md text-sm hover:bg-gray-50">
            再匯入一份
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <Link href="/sales" className="text-sm text-gray-400 hover:text-gray-600">← 客戶訂單</Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-1">匯入出貨文件</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          上傳含 Invoice + Packing List 兩個分頁的 Excel，系統自動解析並建立出貨記錄。
        </p>
      </div>

      {/* 上傳區 */}
      {!parsed && (
        <div>
          <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFile} />
          {parsing ? (
            <div className="bg-teal-50 border-2 border-dashed border-teal-300 rounded-xl p-12 text-center">
              <p className="text-teal-700 font-medium">⏳ 解析中，請稍候…</p>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center gap-4 bg-white border-2 border-dashed border-blue-300 rounded-xl p-12 hover:border-blue-500 hover:bg-blue-50 transition-all text-center">
              <span className="text-5xl">📊</span>
              <div>
                <p className="font-semibold text-gray-800 text-lg">點擊上傳出貨 Excel</p>
                <p className="text-sm text-gray-500 mt-1">支援 .xls / .xlsx，需含 Invoice 和 PackingList 兩個分頁</p>
              </div>
            </button>
          )}
          {parseError && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              ❌ {parseError}
            </p>
          )}
        </div>
      )}

      {/* 解析結果 */}
      {parsed && (
        <>
          {/* 基本資料 */}
          <div className="bg-white rounded-lg border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">解析結果</h2>
              <button type="button" onClick={() => { setParsed(null); setMatchedOrder(null) }}
                className="text-xs text-gray-400 hover:text-gray-600">重新上傳</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {[
                { label: 'Invoice No.', value: parsed.invoiceNo },
                { label: 'Packing List No.', value: parsed.packingListNo },
                { label: '訂單號', value: parsed.orderNo },
                { label: '出貨日期', value: parsed.shipmentDate },
                { label: '買方', value: parsed.soldTo },
                { label: '付款條件', value: parsed.paymentTerms },
                { label: '出貨地', value: parsed.origin },
                { label: '目的地', value: parsed.destination },
                { label: '總箱數', value: parsed.totalCartons ? `${parsed.totalCartons} CTNS` : null },
                { label: '總毛重', value: parsed.totalGrossWeightKg ? `${parsed.totalGrossWeightKg} kg` : null },
                { label: '總淨重', value: parsed.totalNetWeightKg ? `${parsed.totalNetWeightKg} kg` : null },
                { label: '總材積', value: parsed.totalCft ? `${parsed.totalCft} ft³` : null },
              ].filter(f => f.value).map(f => (
                <div key={f.label}>
                  <p className="text-gray-400">{f.label}</p>
                  <p className="font-medium text-gray-800">{f.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 品項明細 */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">品項明細（{parsed.items.length} 項）</h2>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Item No.</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">描述</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">數量</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">單價</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">毛重 kg</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">材積 ft³</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {parsed.items.map((it, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 font-mono font-medium">{it.itemNo}</td>
                    <td className="px-4 py-2 text-gray-600 max-w-xs truncate">{it.description || '—'}</td>
                    <td className="px-4 py-2 text-right">{it.qty} {it.unit}</td>
                    <td className="px-4 py-2 text-right">{it.unitPrice != null ? `${it.currency} ${it.unitPrice}` : '—'}</td>
                    <td className="px-4 py-2 text-right">{it.grossWeightKg ?? '—'}</td>
                    <td className="px-4 py-2 text-right">{it.cft ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-4 py-2 font-medium text-gray-700 text-right">貨品小計</td>
                  <td className="px-4 py-2 text-right font-bold">
                    {parsed.currency} {parsed.goodsTotal?.toFixed(2) ?? '—'}
                  </td>
                  <td colSpan={2} />
                </tr>
                {parsed.additionalCharges.map((c, i) => (
                  <tr key={i} className="text-amber-700">
                    <td colSpan={3} className="px-4 py-1.5 text-right text-xs">{c.description}</td>
                    <td className="px-4 py-1.5 text-right text-xs font-medium">
                      {c.currency} {c.amount.toFixed(2)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                ))}
                <tr className="font-bold">
                  <td colSpan={3} className="px-4 py-2 text-right text-sm">Total</td>
                  <td className="px-4 py-2 text-right text-sm">
                    {parsed.currency} {parsed.totalAmount?.toFixed(2) ?? '—'}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 連結客戶訂單 */}
          <div className="bg-white rounded-lg border p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">連結客戶訂單</h2>
            <div className="flex gap-2">
              <input value={manualOrderNo} onChange={e => setManualOrderNo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchOrder(manualOrderNo)}
                placeholder="輸入訂單號搜尋…"
                className="flex-1 border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <button type="button" onClick={() => searchOrder(manualOrderNo)} disabled={searching}
                className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                {searching ? '搜尋中…' : '搜尋'}
              </button>
            </div>
            {matchError && <p className="text-xs text-red-500">{matchError}</p>}
            {matchedOrder && (
              <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
                <p className="font-medium text-green-800">✓ 已找到訂單</p>
                <p className="text-xs text-gray-600 mt-1">
                  <span className="font-mono">{matchedOrder.orderNo}</span>
                  {matchedOrder.customerName && ` — ${matchedOrder.customerName}`}
                  <span className="ml-2 text-gray-400">（{matchedOrder.items.length} 項品項）</span>
                </p>
              </div>
            )}
          </div>

          {/* 出貨細節 */}
          <div className="bg-white rounded-lg border p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">出貨細節</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">實際出貨日 *</label>
                <input type="date" value={actualShipDate} onChange={e => setActualShipDate(e.target.value)}
                  className="mt-1 w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500">運送方式</label>
                <input value={shippingMethod} onChange={e => setShippingMethod(e.target.value)}
                  placeholder="FOB / Air / Sea…"
                  className="mt-1 w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500">裝載港</label>
                <input value={portOfLoading} onChange={e => setPortOfLoading(e.target.value)}
                  placeholder="TAIWAN"
                  className="mt-1 w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500">目的港</label>
                <input value={portOfDischarge} onChange={e => setPortOfDischarge(e.target.value)}
                  placeholder="GERMANY"
                  className="mt-1 w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-500">追蹤號（選填）</label>
                <input value={trackingNo} onChange={e => setTrackingNo(e.target.value)}
                  placeholder="UPS / DHL tracking no."
                  className="mt-1 w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* 確認儲存 */}
          {saveError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">❌ {saveError}</p>
          )}
          <button type="button" onClick={handleSave}
            disabled={saving || !matchedOrder || !actualShipDate}
            className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? '儲存中…' : '✓ 確認，記錄出貨到 PAXIS'}
          </button>
        </>
      )}
    </div>
  )
}
