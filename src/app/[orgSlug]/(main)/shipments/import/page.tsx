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
  currencyCode: string
  exchangeRate: string | null  // 訂單建立時登記的匯率
  totalAmountForeign: number | null  // 訂單外幣總額
  items: Array<{ id: number; sku: string | null; quantity: number; unit: string; unitPrice: string }>
  /** 目前有效（status=0）的 PI id，出貨時需要傳入才能正確扣 reservedQty */
  activePiId: number | null
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

  // 匯率計算（EUR → TWD）
  const [twdTotal, setTwdTotal] = useState('')  // 使用者輸入的 TWD 付款總額

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
  const [savedOrderId, setSavedOrderId] = useState<number | null>(null)

  // ── 上傳解析 ─────────────────────────────────────────────────────────────────

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setParsing(true); setParseError(''); setParsed(null); setMatchedOrder(null)
    setTwdTotal('')

    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/parse-shipment-excel', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '解析失敗')
      const result: ParsedShipmentExcel = data.data
      setParsed(result)

      if (result.shipmentDate) setActualShipDate(result.shipmentDate)
      if (result.paymentTerms) setShippingMethod(result.paymentTerms)
      if (result.origin) setPortOfLoading(result.origin)
      if (result.destination) setPortOfDischarge(result.destination)

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
      const res = await fetch(`/api/sales?search=${encodeURIComponent(orderNo.trim())}&limit=5`)
      const data = await res.json()
      const orders = data.orders ?? []
      const found = orders.find((o: { orderNo: string }) => o.orderNo === orderNo.trim()) ?? orders[0]
      if (!found) { setMatchError(`找不到訂單「${orderNo}」`); return }

      const detailRes = await fetch(`/api/sales/${found.id}`)
      const detail = await detailRes.json()
      const detailItems = (detail.items ?? []) as Array<{ id: number; product: { sku: string | null }; quantity: number; unit: string; unitPrice: string }>
      const totalAmountForeign = detailItems.reduce((sum, it) => sum + it.quantity * parseFloat(it.unitPrice || '0'), 0)
      // 找出最近一張有效（status=0）的 PI，出貨時需要帶入才能正確扣 reservedQty
      const activePis = (detail.pis ?? []) as Array<{ id: number; status: number }>
      const activePiId = activePis.find(p => p.status === 0)?.id ?? null
      setMatchedOrder({
        id: detail.id,
        orderNo: detail.orderNo,
        customerName: detail.customer?.name ?? detail.patiscoBuyerName ?? null,
        currencyCode: detail.currencyCode ?? 'EUR',
        exchangeRate: detail.exchangeRate ?? null,
        totalAmountForeign: totalAmountForeign || null,
        activePiId,
        items: detailItems.map(it => ({
          id: it.id,
          sku: it.product?.sku ?? null,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
        })),
      })
    } catch {
      setMatchError('搜尋失敗')
    } finally {
      setSearching(false)
    }
  }

  // ── 匯率計算 ──────────────────────────────────────────────────────────────────

  // CI EUR 總金額（含附加費用）
  const eurTotal = parsed?.totalAmount ?? null

  // 訂單登記匯率（TWD/EUR）
  const orderExRate = matchedOrder?.exchangeRate ? parseFloat(matchedOrder.exchangeRate) : null

  // 依訂單匯率換算 TWD
  const twdByOrderRate = (eurTotal != null && orderExRate != null)
    ? eurTotal * orderExRate
    : null

  // 訂單外幣總額 × 訂單匯率 → 訂單 TWD 金額
  const orderTwdEstimate = (matchedOrder?.totalAmountForeign != null && orderExRate != null)
    ? matchedOrder.totalAmountForeign * orderExRate
    : null

  // 依使用者填入的實際 TWD 收款金額反算出貨匯率
  const twdTotalNum = twdTotal.trim() !== '' ? parseFloat(twdTotal) : null
  const impliedRate = (twdTotalNum != null && eurTotal != null && eurTotal > 0)
    ? twdTotalNum / eurTotal
    : null

  // 若未輸入 TWD，則以「訂單 TWD 估算 ÷ CI 外幣總額」推算預估出貨匯率
  // 公式：(訂單外幣 × 訂單匯率) / CI 外幣 = 預估出貨匯率
  const estimatedRate = (impliedRate == null && orderTwdEstimate != null && eurTotal != null && eurTotal > 0)
    ? orderTwdEstimate / eurTotal
    : null

  // ── 儲存到 PAXIS ──────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!parsed || !matchedOrder) return
    if (!actualShipDate) { setSaveError('請填寫實際出貨日'); return }

    setSaving(true); setSaveError('')
    try {
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
          cbm: parsedItem?.cft != null ? parsedItem.cft : null,
        }
      })

      // 匯率備註：組合成 note 附帶（後續有欄位後可獨立存）
      let rateNote = ''
      if (eurTotal != null) {
        rateNote += `CI 總金額：${parsed.currency ?? 'EUR'} ${eurTotal.toFixed(2)}`
        if (twdTotalNum != null && impliedRate != null) {
          rateNote += `；實付 TWD ${twdTotalNum.toLocaleString()}，實際匯率 ${impliedRate.toFixed(4)}`
        } else if (twdByOrderRate != null && orderExRate != null) {
          rateNote += `；依訂單匯率 ${orderExRate} 換算 TWD ${twdByOrderRate.toFixed(0)}`
        }
      }

      const res = await fetch(`/api/sales/${matchedOrder.id}/shipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          piId: matchedOrder.activePiId ?? null,   // ★ 傳入才能正確扣 reservedQty
          actualShipDate,
          shippingMethod: shippingMethod || null,
          portOfLoading: portOfLoading || null,
          portOfDischarge: portOfDischarge || null,
          trackingNo: trackingNo || null,
          packingListNo: parsed.packingListNo || null,
          commercialInvNo: parsed.invoiceNo || null,
          note: rateNote || null,
          source: 'AI_IMPORT',
          items,
        }),
      })
      let resData: { shipmentNo?: string; error?: string } = {}
      try { resData = await res.json() } catch { /* empty body */ }
      if (!res.ok) throw new Error(resData.error ?? `HTTP ${res.status} 儲存失敗`)
      setSavedShipmentNo(resData.shipmentNo ?? 'SHP-???')
      setSavedOrderId(matchedOrder.id)
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
        <div className="bg-green-50 border-2 border-green-400 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">✅</span>
            <div>
              <h2 className="text-lg font-bold text-green-800">出貨記錄已建立成功</h2>
              <p className="text-sm text-green-700">庫存已扣減，應收帳款已建立</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-green-200 px-4 py-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">出貨單號</span>
              <span className="font-mono font-bold text-gray-800">{savedShipmentNo}</span>
            </div>
            {matchedOrder && (
              <div className="flex justify-between">
                <span className="text-gray-500">訂單</span>
                <span className="font-mono text-gray-700">{matchedOrder.orderNo}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          {savedOrderId && (
            <button type="button"
              onClick={() => router.push(`/sales/${savedOrderId}`)}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-blue-700">
              → 查看這張訂單
            </button>
          )}
          <button type="button"
            onClick={() => router.push(`/shipments`)}
            className="flex-1 bg-teal-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-teal-700">
            出貨單列表
          </button>
          <button type="button"
            onClick={() => {
              setParsed(null); setMatchedOrder(null); setSavedShipmentNo(null); setSavedOrderId(null)
              setActualShipDate(''); setShippingMethod(''); setPortOfLoading('')
              setPortOfDischarge(''); setTrackingNo(''); setTwdTotal('')
            }}
            className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-md text-sm hover:bg-gray-50">
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
        <Link href="/shipments" className="text-sm text-gray-400 hover:text-gray-600">← 出貨單列表</Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-1">匯入出貨文件</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          上傳含 Invoice + Packing List 兩個分頁的 Excel，系統自動解析並建立出貨記錄。
        </p>
      </div>

      {/* 上傳區 */}
      {!parsed && (
        <div>
          <input ref={fileRef} type="file" accept=".xls,.xlsx,.pdf,image/*" className="hidden" onChange={handleFile} />
          {parsing ? (
            <div className="bg-indigo-50 border-2 border-dashed border-indigo-300 rounded-xl p-12 text-center">
              <p className="text-indigo-700 font-medium">⏳ 解析中，請稍候…（PDF 會先轉圖片，需要稍等）</p>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center gap-4 bg-white border-2 border-dashed border-indigo-300 rounded-xl p-12 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-center">
              <span className="text-5xl">📄</span>
              <div>
                <p className="font-semibold text-gray-800 text-lg">點擊上傳出貨文件</p>
                <p className="text-sm text-gray-500 mt-1">PDF（AI Vision 解析）或 Excel（.xls / .xlsx）</p>
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
              <button type="button" onClick={() => { setParsed(null); setMatchedOrder(null); setTwdTotal('') }}
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

          {/* 前往 UPS 估運費 */}
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-5 py-3">
            <div>
              <p className="text-sm font-medium text-amber-800">📦 用這份文件估 UPS 運費</p>
              <p className="text-xs text-amber-600 mt-0.5">
                重量 {parsed.totalGrossWeightKg ?? '—'} kg，
                {parsed.totalCartons ?? '—'} 箱，
                {parsed.totalCft ?? '—'} ft³，
                申報 {parsed.currency ?? 'EUR'} {parsed.totalAmount?.toFixed(2) ?? '—'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                // 優先用 deliverToAddress，沒有才用 soldToAddress
                const recipientAddr = parsed.deliverToAddress ?? parsed.soldToAddress ?? null
                sessionStorage.setItem('ups_prefill', JSON.stringify({
                  totalCartons:       parsed.totalCartons,
                  totalGrossWeightKg: parsed.totalGrossWeightKg,
                  totalCft:           parsed.totalCft,
                  totalAmount:        parsed.totalAmount,
                  currency:           parsed.currency,
                  soldTo:             parsed.soldTo,
                  dimensionsCm:       parsed.dimensionsCm ?? null,
                  // 寄件方（CI 上的 Shipment 欄位，可能是供應商）
                  shipperName:        parsed.shipperName ?? null,
                  // 收件方完整地址
                  recipientAddress: recipientAddr ? {
                    name:        recipientAddr.name,
                    addressLine: recipientAddr.addressLine,
                    city:        recipientAddr.city,
                    postalCode:  recipientAddr.postalCode,
                    countryCode: recipientAddr.countryCode,
                  } : null,
                  items:              parsed.items.map(it => ({
                    itemNo:      it.itemNo,
                    description: it.description,
                    qty:         it.qty,
                    unit:        it.unit,
                    unitPrice:   it.unitPrice,
                    currency:    it.currency,
                  })),
                }))
                router.push('/shipping')
              }}
              className="ml-4 bg-amber-500 text-white text-sm px-4 py-2 rounded-md hover:bg-amber-600 whitespace-nowrap"
            >
              前往估運費 →
            </button>
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
                  {matchedOrder.exchangeRate && (
                    <span className="ml-2 text-gray-400">訂單登記匯率：{matchedOrder.exchangeRate}</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* 出貨匯率計算 */}
          {eurTotal != null && (
            <div className="bg-white rounded-lg border p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">出貨匯率計算</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  輸入實際 TWD 收款金額，系統自動計算本次出貨使用的匯率。
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
                {/* 訂單外幣金額（唯讀） */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">訂單金額（{matchedOrder?.currencyCode ?? 'EUR'}）</p>
                  <div className="bg-gray-50 border rounded px-3 py-2 text-sm font-mono text-gray-600">
                    {matchedOrder?.totalAmountForeign != null
                      ? `${matchedOrder.currencyCode} ${matchedOrder.totalAmountForeign.toFixed(2)}`
                      : '—'}
                  </div>
                </div>

                {/* CI 總金額（唯讀） */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">CI 總金額（{parsed.currency ?? 'EUR'}）</p>
                  <div className="bg-gray-50 border rounded px-3 py-2 text-sm font-mono font-medium text-gray-800">
                    {parsed.currency ?? 'EUR'} {eurTotal.toFixed(2)}
                  </div>
                </div>

                {/* 使用者填入 TWD */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">實際收款金額（TWD）</p>
                  <input
                    type="number"
                    value={twdTotal}
                    onChange={e => setTwdTotal(e.target.value)}
                    placeholder={orderTwdEstimate != null ? `估 ${Math.round(orderTwdEstimate).toLocaleString()}` : '輸入 TWD'}
                    className="w-full border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* 出貨匯率 */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">出貨匯率（TWD/{parsed.currency ?? 'EUR'}）</p>
                  <div className={`border rounded px-3 py-2 text-sm font-mono font-bold ${
                    impliedRate != null ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : estimatedRate != null ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-gray-50 text-gray-400'
                  }`}>
                    {impliedRate != null
                      ? impliedRate.toFixed(4)
                      : estimatedRate != null
                        ? `≈ ${estimatedRate.toFixed(4)} （訂單估算）`
                        : '— 請輸入 TWD 金額'}
                  </div>
                </div>
              </div>

              {/* 比對說明 */}
              {impliedRate != null && orderExRate != null && (
                <div className="text-xs text-gray-500 bg-gray-50 rounded p-3 space-y-0.5">
                  <p>
                    訂單登記匯率：<span className="font-mono font-medium">{orderExRate}</span>
                    {orderTwdEstimate != null && <>
                      {' '}→ 訂單估算 TWD{' '}
                      <span className="font-mono font-medium">{Math.round(orderTwdEstimate).toLocaleString()}</span>
                    </>}
                  </p>
                  <p>
                    本次出貨匯率：<span className="font-mono font-medium">{impliedRate.toFixed(4)}</span>
                    {' '}→ 實際收款 TWD{' '}
                    <span className="font-mono font-medium">{Number(twdTotalNum).toLocaleString()}</span>
                    {' '}
                    <span className={impliedRate > orderExRate ? 'text-green-600' : 'text-red-500'}>
                      ({impliedRate > orderExRate ? '▲' : '▼'} 匯率差 {Math.abs(impliedRate - orderExRate).toFixed(4)})
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

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
