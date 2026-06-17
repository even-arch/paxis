'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useOrgPath } from '@/lib/use-org-path'

type BreakdownItem = { productName: string; sku: string | null; qty: number; unitPrice: number; value: number }
type SupplierBreakdown = {
  shipmentNo: string
  actualShipDate: string
  currencyCode: string
  totalValue: number
  breakdown: { supplierId: number | null; supplierName: string; totalValue: number; pct: number; items: BreakdownItem[] }[]
}

type OrderItem = {
  id: number
  quantity: number
  shippedQty: number
  unit: string | null
  product: { id: number; name: string; sku: string | null; unit: string | null }
}

type ActivePI = {
  id: number
  piNo: string
  estimatedShipDate: string | null
}

type ShipmentItem = {
  id: number
  productName: string
  sku: string | null
  quantity: number
  cartons: number | null
  grossWeightKg: number | null
  cbm: number | null
}

type ExistingShipment = {
  id: number
  shipmentNo: string
  actualShipDate: string
  shippingMethod: string | null
  portOfLoading: string | null
  portOfDischarge: string | null
  trackingNo: string | null
  packingListNo: string | null
  commercialInvNo: string | null
  note: string | null
  source: string
  performedAt: string
  performerName: string | null
  piNos: string[]   // 此出貨關聯的所有 PI 號碼（追溯用）
  items: ShipmentItem[]
}

type Props = {
  orderId: number
  orderStatus: number
  items: OrderItem[]
  activePIs: ActivePI[]
  shipments: ExistingShipment[]
}

const SHIP_VIA = ['SEA', 'AIR', 'COURIER', 'TRUCK', 'EXPRESS']

export default function SalesShipmentPanel({ orderId, orderStatus, items, activePIs, shipments }: Props) {
  const router = useRouter()
  const toOrgPath = useOrgPath()
  const [showForm, setShowForm] = useState(false)
  const [actualShipDate, setActualShipDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedPiId, setSelectedPiId] = useState<string>(activePIs[0]?.id ? String(activePIs[0].id) : '')
  const [shippingMethod, setShippingMethod] = useState('')
  const [portOfLoading, setPortOfLoading] = useState('')
  const [portOfDischarge, setPortOfDischarge] = useState('')
  const [trackingNo, setTrackingNo] = useState('')
  const [note, setNote] = useState('')
  const [shipItems, setShipItems] = useState<{ slsItemId: number; quantity: string }[]>(
    items.map(i => ({
      slsItemId: i.id,
      quantity: String(Math.max(0, i.quantity - i.shippedQty)),
    }))
  )
  const [ciExchangeRate, setCiExchangeRate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 刪除出貨記錄
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  async function handleDeleteShipment(shipmentId: number) {
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/sales/${orderId}/shipment?shipmentId=${shipmentId}`, { method: 'DELETE' })
      const json = await res.json() as { error?: string }
      if (!res.ok) { setError(json.error ?? '刪除失敗'); return }
      setDeletingId(null)
      router.refresh()
    } finally {
      setDeleteLoading(false)
    }
  }

  // 出貨詳細展開狀態
  const [expandedDetail, setExpandedDetail] = useState<number | null>(null)
  // 供應商佔比展開狀態
  const [expandedBreakdown, setExpandedBreakdown] = useState<number | null>(null)
  const [breakdownData, setBreakdownData] = useState<Record<number, SupplierBreakdown>>({})
  const [breakdownLoading, setBreakdownLoading] = useState<number | null>(null)

  const loadBreakdown = useCallback(async (shipmentId: number) => {
    if (breakdownData[shipmentId]) {
      setExpandedBreakdown(prev => prev === shipmentId ? null : shipmentId)
      return
    }
    setBreakdownLoading(shipmentId)
    const res = await fetch(`/api/sales/${orderId}/shipment/${shipmentId}/supplier-breakdown`)
    const data = await res.json() as SupplierBreakdown
    setBreakdownData(prev => ({ ...prev, [shipmentId]: data }))
    setExpandedBreakdown(shipmentId)
    setBreakdownLoading(null)
  }, [breakdownData, orderId])

  function exportCSV(shipmentId: number) {
    const d = breakdownData[shipmentId]
    if (!d) return
    const rows = [
      ['出貨單號', d.shipmentNo],
      ['出貨日期', d.actualShipDate.slice(0, 10)],
      ['幣別', d.currencyCode],
      [''],
      ['供應商', '金額', '佔比%', '商品', 'SKU', '數量', '單價'],
      ...d.breakdown.flatMap(b =>
        b.items.map((it, i) => [
          i === 0 ? b.supplierName : '',
          i === 0 ? b.totalValue.toFixed(2) : '',
          i === 0 ? b.pct.toFixed(2) : '',
          it.productName,
          it.sku ?? '',
          it.qty,
          it.unitPrice.toFixed(4),
        ])
      ),
      [''],
      ['合計', d.totalValue.toFixed(2), '100.00'],
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${d.shipmentNo}-供應商佔比.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  async function exportExcel(shipmentId: number) {
    const d = breakdownData[shipmentId]
    if (!d) return
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx') as {
      utils: {
        book_new: () => unknown
        aoa_to_sheet: (data: unknown[][]) => unknown
        book_append_sheet: (wb: unknown, ws: unknown, name: string) => void
      }
      writeFile: (wb: unknown, filename: string) => void
    }
    const aoa: unknown[][] = [
      ['出貨單號', d.shipmentNo, '', '出貨日期', d.actualShipDate.slice(0, 10), '', '幣別', d.currencyCode],
      [],
      ['供應商', '金額', '佔比%', '商品', 'SKU', '數量', '單價', '小計'],
      ...d.breakdown.flatMap(b =>
        b.items.map((it, i) => [
          i === 0 ? b.supplierName : '',
          i === 0 ? b.totalValue : '',
          i === 0 ? `${b.pct.toFixed(2)}%` : '',
          it.productName,
          it.sku ?? '',
          it.qty,
          it.unitPrice,
          it.value,
        ])
      ),
      [],
      ['合計', d.totalValue, '100.00%'],
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(wb, ws, '供應商佔比')
    XLSX.writeFile(wb, `${d.shipmentNo}-供應商佔比.xlsx`)
  }

  const canShip = orderStatus !== 4 && orderStatus !== 5

  async function handleShip(e: React.FormEvent) {
    e.preventDefault()
    if (!actualShipDate) { setError('實際出貨日為必填'); return }

    const itemsToShip = shipItems.filter(i => Number(i.quantity) > 0)
    if (!itemsToShip.length) { setError('至少需要一項出貨數量大於 0'); return }

    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/sales/${orderId}/shipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          piIds: selectedPiId ? [Number(selectedPiId)] : [],
          actualShipDate,
          shippingMethod: shippingMethod || null,
          portOfLoading: portOfLoading || null,
          portOfDischarge: portOfDischarge || null,
          trackingNo: trackingNo || null,
          ciExchangeRate: ciExchangeRate ? Number(ciExchangeRate) : null,
          note: note || null,
          items: itemsToShip.map(i => ({ slsItemId: i.slsItemId, quantity: Number(i.quantity) })),
        }),
      })
      const json = await res.json() as { shipmentNo?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? '出貨失敗')
      setShowForm(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-700">出貨管理</h2>
          <p className="text-xs text-gray-400 mt-0.5">確認出貨後，系統以實際離港日記錄，庫存正式扣減（quantity--）</p>
        </div>
        {canShip && !showForm && (
          <button onClick={() => setShowForm(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700">
            + 確認出貨
          </button>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="underline text-xs ml-4">關閉</button>
        </div>
      )}

      {/* 出貨表單 */}
      {showForm && (
        <form onSubmit={handleShip} className="p-6 border-b border-gray-100 bg-green-50">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">填寫出貨資料</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                實際出貨日 / 離港日 <span className="text-red-500">*</span>
              </label>
              <input type="date" value={actualShipDate} onChange={e => setActualShipDate(e.target.value)}
                className={inp} required />
              <p className="text-xs text-gray-400 mt-1">此為最終確定的出倉日期</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">對應 PI（選填）</label>
              <select value={selectedPiId} onChange={e => setSelectedPiId(e.target.value)} className={inp}>
                <option value="">無 PI（直接出貨）</option>
                {activePIs.map(pi => (
                  <option key={pi.id} value={String(pi.id)}>
                    {pi.piNo}{pi.estimatedShipDate ? ` — 預計 ${pi.estimatedShipDate.slice(0, 10)}` : ''}
                  </option>
                ))}
              </select>
              {!selectedPiId && (
                <p className="text-xs text-amber-600 mt-1">⚠ 未選 PI：僅扣減實際庫存，不扣預留量</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">運送方式</label>
              <select value={shippingMethod} onChange={e => setShippingMethod(e.target.value)} className={inp}>
                <option value="">請選擇</option>
                {SHIP_VIA.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">追蹤號碼 / B/L / AWB</label>
              <input type="text" value={trackingNo} onChange={e => setTrackingNo(e.target.value)}
                className={inp} placeholder="提單號或空運提單號" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">裝運港</label>
              <input type="text" value={portOfLoading} onChange={e => setPortOfLoading(e.target.value)}
                className={inp} placeholder="TWKHH / CNSHA" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">目的港</label>
              <input type="text" value={portOfDischarge} onChange={e => setPortOfDischarge(e.target.value)}
                className={inp} placeholder="USLAX / DEHAM" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                CI 出貨匯率（選填）
                <span className="text-gray-400 font-normal ml-1">Commercial Invoice 上使用的匯率</span>
              </label>
              <input type="number" step="0.0001" min="0" value={ciExchangeRate}
                onChange={e => setCiExchangeRate(e.target.value)}
                className={inp} placeholder="例：35.5000" />
              <p className="text-xs text-gray-400 mt-1">填入可準確計算匯差；不填則沿用訂單匯率</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">備註</label>
              <input type="text" value={note} onChange={e => setNote(e.target.value)} className={inp} />
            </div>
          </div>

          {/* 出貨數量 */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-2">本次出貨數量</label>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-200">
                  <th className="text-left pb-2 font-normal">商品</th>
                  <th className="text-right pb-2 font-normal w-20">訂單量</th>
                  <th className="text-right pb-2 font-normal w-20">已出貨</th>
                  <th className="text-right pb-2 font-normal w-20">剩餘</th>
                  <th className="text-right pb-2 font-normal w-24">本次出貨</th>
                  <th className="text-left pb-2 font-normal w-14">單位</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => {
                  const remaining = item.quantity - item.shippedQty
                  return (
                    <tr key={item.id}>
                      <td className="py-2">
                        <span className="font-medium text-gray-800">{item.product.name}</span>
                        {item.product.sku && <span className="text-gray-400 text-xs ml-1">({item.product.sku})</span>}
                      </td>
                      <td className="py-2 text-right text-gray-500">{item.quantity.toLocaleString()}</td>
                      <td className="py-2 text-right text-gray-500">{item.shippedQty.toLocaleString()}</td>
                      <td className="py-2 text-right">
                        <span className={remaining > 0 ? 'text-amber-600 font-medium' : 'text-green-600'}>
                          {remaining.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2 pr-2">
                        <input type="number" min="0" max={remaining}
                          value={shipItems[idx]?.quantity ?? ''}
                          onChange={e => setShipItems(p => p.map((si, i) => i === idx ? { ...si, quantity: e.target.value } : si))}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
                      </td>
                      <td className="py-2 text-gray-500">{item.unit ?? item.product.unit ?? 'PCS'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="bg-green-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {saving ? '出貨中…' : '✓ 確認出貨，扣減庫存'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError('') }}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
              取消
            </button>
          </div>
        </form>
      )}

      {/* 出貨紀錄 */}
      {shipments.length === 0 && !showForm ? (
        <div className="px-6 py-8 text-center text-gray-400 text-sm">尚未出貨</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {shipments.map(s => (
            <div key={s.id} className="px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono font-medium text-gray-800">{s.shipmentNo}</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">已出貨</span>
                    {s.shippingMethod && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{s.shippingMethod}</span>}
                    {s.source === 'AI_IMPORT' && <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded">AI 匯入</span>}
                    {s.source === 'UPS' && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded">UPS</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 mb-1">
                    <span>離港日：<span className="text-gray-700 font-medium">{s.actualShipDate.slice(0, 10)}</span></span>
                    {s.portOfLoading && <span>裝運港：<span className="text-gray-700">{s.portOfLoading}</span></span>}
                    {s.portOfDischarge && <span>目的港：<span className="text-gray-700">{s.portOfDischarge}</span></span>}
                    {s.trackingNo && <span>B/L：<span className="font-mono text-gray-700">{s.trackingNo}</span></span>}
                    {s.packingListNo && <span>P/L 號：<span className="font-mono text-gray-700">{s.packingListNo}</span></span>}
                    {s.commercialInvNo && <span>C/I 號：<span className="font-mono text-gray-700">{s.commercialInvNo}</span></span>}
                  </div>
                  {/* PI 號碼追溯（對外核對用，不可更動） */}
                  {s.piNos.length > 0 && (
                    <div className="text-xs text-gray-500 mb-1">
                      PI：{s.piNos.map((no, i) => (
                        <span key={i} className="font-mono text-indigo-600 mr-2">{no}</span>
                      ))}
                    </div>
                  )}
                  {/* 品項摘要 */}
                  <div className="text-xs text-gray-400">
                    {s.items.map(it => (
                      <span key={it.id} className="mr-3">
                        {it.productName}{it.sku ? ` (${it.sku})` : ''} × {it.quantity.toLocaleString()}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-start gap-2 ml-4 shrink-0">
                  <a
                    href={toOrgPath(`/print/pl/${s.id}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-gray-100 text-gray-700 border border-gray-300 px-2 py-0.5 rounded hover:bg-gray-200 whitespace-nowrap"
                  >
                    🖨 裝箱單
                  </a>
                  <a
                    href={toOrgPath(`/print/ci/${s.id}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-gray-100 text-gray-700 border border-gray-300 px-2 py-0.5 rounded hover:bg-gray-200 whitespace-nowrap"
                  >
                    🖨 商業發票
                  </a>
                  <button
                    onClick={() => setExpandedDetail(prev => prev === s.id ? null : s.id)}
                    className="text-xs text-indigo-600 hover:underline whitespace-nowrap">
                    {expandedDetail === s.id ? '▲ 收起' : '▼ 詳細'}
                  </button>
                  <button
                    onClick={() => loadBreakdown(s.id)}
                    className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                    {breakdownLoading === s.id ? '計算中…' : expandedBreakdown === s.id ? '▲ 收起佔比' : '▼ 供應商佔比'}
                  </button>
                  {/* UPS 出貨按鈕：沒有 trackingNo 時顯示，有了就改顯示追蹤號 */}
                  {s.trackingNo && s.source === 'UPS' ? (
                    <span className="text-xs bg-orange-50 border border-orange-200 text-orange-700 px-2 py-0.5 rounded font-mono">
                      UPS: {s.trackingNo}
                    </span>
                  ) : (
                    <a
                      href={toOrgPath(`/shipping?slsShipmentId=${s.id}`)}
                      className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded hover:bg-amber-600 whitespace-nowrap">
                      📦 UPS 出貨
                    </a>
                  )}
                  <div className="text-right text-xs text-gray-400">
                    <div>操作：{s.performerName ?? '-'}</div>
                    <div>{new Date(s.performedAt).toLocaleDateString('zh-TW')}</div>
                    {/* 刪除出貨記錄 */}
                    {deletingId === s.id ? (
                      <div className="mt-1 flex items-center gap-1 justify-end">
                        <button onClick={() => handleDeleteShipment(s.id)} disabled={deleteLoading}
                          className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700 disabled:opacity-50">
                          {deleteLoading ? '…' : '確認刪除'}
                        </button>
                        <button onClick={() => setDeletingId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600">取消</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeletingId(s.id)}
                        className="mt-1 text-xs text-red-400 hover:text-red-600 hover:underline">
                        刪除此出貨
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 詳細資料展開區 */}
              {expandedDetail === s.id && (
                <div className="mt-3 border border-indigo-100 rounded-lg overflow-hidden">
                  <div className="bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700">出貨完整紀錄</div>
                  <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
                    <div><span className="text-gray-400">出貨單號：</span><span className="font-mono font-medium">{s.shipmentNo}</span></div>
                    <div><span className="text-gray-400">離港日：</span><span className="font-medium">{s.actualShipDate.slice(0, 10)}</span></div>
                    {s.shippingMethod && <div><span className="text-gray-400">運送方式：</span>{s.shippingMethod}</div>}
                    {s.portOfLoading && <div><span className="text-gray-400">裝運港（POL）：</span>{s.portOfLoading}</div>}
                    {s.portOfDischarge && <div><span className="text-gray-400">目的港（POD）：</span>{s.portOfDischarge}</div>}
                    {s.trackingNo && <div><span className="text-gray-400">B/L / AWB：</span><span className="font-mono">{s.trackingNo}</span></div>}
                    {s.packingListNo && <div><span className="text-gray-400">Packing List No.：</span><span className="font-mono">{s.packingListNo}</span></div>}
                    {s.commercialInvNo && <div><span className="text-gray-400">Commercial Invoice No.：</span><span className="font-mono">{s.commercialInvNo}</span></div>}
                  </div>
                  {/* 品項明細 */}
                  <table className="w-full text-xs border-t border-indigo-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-gray-500">商品</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-500">料號</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-500">數量</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-500">箱數</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-500">毛重(kg)</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-500">材積</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {s.items.map(it => (
                        <tr key={it.id}>
                          <td className="px-4 py-2 font-medium text-gray-800">{it.productName}</td>
                          <td className="px-4 py-2 font-mono text-gray-500">{it.sku ?? '-'}</td>
                          <td className="px-4 py-2 text-right">{it.quantity.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right">{it.cartons ?? '-'}</td>
                          <td className="px-4 py-2 text-right">{it.grossWeightKg != null ? it.grossWeightKg.toFixed(2) : '-'}</td>
                          <td className="px-4 py-2 text-right">{it.cbm != null ? it.cbm.toFixed(3) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {s.note && (
                    <div className="px-4 py-3 border-t border-indigo-100 text-xs text-gray-600 bg-gray-50">
                      <span className="text-gray-400">備註：</span>{s.note}
                    </div>
                  )}
                </div>
              )}

              {/* 供應商佔比展開區塊 */}
              {expandedBreakdown === s.id && breakdownData[s.id] && (() => {
                const d = breakdownData[s.id]
                return (
                  <div className="mt-4 border border-blue-100 rounded-lg overflow-hidden">
                    <div className="bg-blue-50 px-4 py-2.5 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-blue-700">供應商出貨佔比</span>
                        <span className="text-xs text-blue-500 ml-2">總額 {d.currencyCode} {d.totalValue.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => exportCSV(s.id)}
                          className="text-xs bg-white border border-blue-200 text-blue-600 px-2.5 py-1 rounded hover:bg-blue-50">
                          CSV
                        </button>
                        <button onClick={() => exportExcel(s.id)}
                          className="text-xs bg-white border border-green-200 text-green-600 px-2.5 py-1 rounded hover:bg-green-50">
                          Excel
                        </button>
                      </div>
                    </div>
                    {/* 摘要列（供應商層級） */}
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">供應商</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-600 text-xs">金額 ({d.currencyCode})</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-600 text-xs w-24">佔比</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {d.breakdown.map((b, bi) => (
                          <tr key={bi} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-medium text-gray-800">{b.supplierName}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-sm">
                              {b.totalValue.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-20 bg-gray-200 rounded-full h-1.5">
                                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${b.pct}%` }} />
                                </div>
                                <span className="text-xs font-medium text-blue-700 w-12 text-right">{b.pct.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'
