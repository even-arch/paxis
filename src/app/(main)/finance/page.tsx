'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Payable = {
  id: number
  amountTWD: string
  paidAmountTWD: string | null
  dueDate: string | null
  status: number
  paidAt: string | null
  note: string | null
  supplier: { id: number; name: string; shortName: string | null }
  receipt: { receiptNo: string; performedAt: string; order: { id: number; poNo: string } }
  // 費用明細
  customsFeeTWD:      string | null
  truckingFeeTWD:     string | null
  containerFeeTWD:    string | null
  bankFeePct:         string | null
  portServiceFeeTWD:  string | null
  wireTransferFeeTWD: string | null
  commissionTWD:      string | null
  otherAdjustmentTWD:  string | null
  otherAdjustmentNote: string | null
  vatPct:              string | null
  finalWireAmountTWD:  string | null
}

type Receivable = {
  id: number
  currencyCode: string
  amountForeign: string
  rateAtInvoice: string
  amountTWD: string
  collectedForeign: string | null
  rateAtCollection: string | null
  collectedTWD: string | null
  fxGainLoss: string | null
  dueDate: string | null
  status: number
  collectedAt: string | null
  note: string | null
  customer: { id: number; name: string; shortName: string | null } | null
  customerName: string | null
  shipment: {
    shipmentNo: string
    actualShipDate: string
    pis: { pi: { id: number; piNo: string; order: { id: number; orderNo: string } } }[]
  }
}

const STATUS_PAY = ['未付', '部分付清', '已付清']
const STATUS_PAY_COLOR = ['bg-red-100 text-red-700', 'bg-amber-100 text-amber-700', 'bg-green-100 text-green-700']
const STATUS_REC = ['未收', '部分收款', '已收清']
const STATUS_REC_COLOR = ['bg-red-100 text-red-700', 'bg-amber-100 text-amber-700', 'bg-green-100 text-green-700']

function fmt(n: string | null | undefined, decimals = 0) {
  if (!n) return '—'
  return Number(n).toLocaleString('zh-TW', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('zh-TW')
}
function isOverdue(dueDate: string | null, status: number) {
  if (!dueDate || status === 2) return false
  return new Date(dueDate) < new Date()
}
function isDueSoon(dueDate: string | null, status: number) {
  if (!dueDate || status === 2) return false
  const diff = new Date(dueDate).getTime() - Date.now()
  return diff > 0 && diff < 7 * 86400000
}

type EstimateRow = {
  shipmentId: number
  shipmentNo: string
  actualShipDate: string
  customer: { id: number | null; name: string }
  ar: { foreign: number; currency: string; rate: number; twd: number; fromRecord: boolean; receivableStatus: number | null }
  ap: { twd: number; items: { poNo: string; supplierName: string; amountTWD: number; currency: string; matchType: string }[] }
  gross: { twd: number; pct: number | null }
  hasPoLink: boolean
  warnings: string[]
  unmatchedOrders: string[]
  nullAmountPos: string[]
}

export default function FinancePage() {
  const [tab, setTab] = useState<'pay' | 'rec' | 'est'>('pay')
  const [payFilter, setPayFilter] = useState('')
  const [recFilter, setRecFilter] = useState('')
  const [payables, setPayables] = useState<Payable[]>([])
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [loading, setLoading] = useState(true)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillResult, setBackfillResult] = useState<{ ar: { created: number; skipped: number }; ap: { created: number; skipped: number } } | null>(null)
  const [estimates, setEstimates] = useState<EstimateRow[]>([])
  const [estimatesLoaded, setEstimatesLoaded] = useState(false)

  // 付款對話框
  const [payDialog, setPayDialog] = useState<Payable | null>(null)
  const [payInput, setPayInput] = useState('')
  const [payDateInput, setPayDateInput] = useState('')
  const [payNote, setPayNote] = useState('')
  const [saving, setSaving] = useState(false)
  // 費用明細 state
  const [feeCustoms,      setFeeCustoms]      = useState('')
  const [feeTrucking,     setFeeTrucking]      = useState('')
  const [feeContainer,    setFeeContainer]     = useState('')
  const [feeBankPct,      setFeeBankPct]       = useState('')
  const [feePort,         setFeePort]          = useState('')
  const [feeWire,         setFeeWire]          = useState('')
  const [feeCommission,   setFeeCommission]    = useState('')
  const [feeOtherAmt,     setFeeOtherAmt]      = useState('')
  const [feeOtherNote,    setFeeOtherNote]     = useState('')
  const [feeVatPct,       setFeeVatPct]        = useState('5')
  const [showFeePanel,    setShowFeePanel]     = useState(false)

  // 收款對話框
  const [recDialog, setRecDialog] = useState<Receivable | null>(null)
  const [recForeign, setRecForeign] = useState('')
  const [recRate, setRecRate] = useState('')
  const [recDateInput, setRecDateInput] = useState('')
  const [recNote, setRecNote] = useState('')

  async function loadEstimates() {
    if (estimatesLoaded) return
    const data = await fetch('/api/finance/estimates').then(r => r.json())
    setEstimates(data)
    setEstimatesLoaded(true)
  }

  function switchTab(t: 'pay' | 'rec' | 'est') {
    setTab(t)
    if (t === 'est') loadEstimates()
  }

  async function handleBackfill() {
    setBackfilling(true)
    setBackfillResult(null)
    const res = await fetch('/api/finance/backfill', { method: 'POST' })
    const data = await res.json()
    setBackfillResult(data)
    setBackfilling(false)
    load()
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [p, r] = await Promise.all([
      fetch(`/api/finance/payables${payFilter ? `?status=${payFilter}` : ''}`).then(r => r.json()),
      fetch(`/api/finance/receivables${recFilter ? `?status=${recFilter}` : ''}`).then(r => r.json()),
    ])
    setPayables(p)
    setReceivables(r)
    setLoading(false)
  }, [payFilter, recFilter])

  useEffect(() => { load() }, [load])

  // 費用計算輔助函式
  function calcFees(base: number) {
    const customs    = parseFloat(feeCustoms)    || 0
    const trucking   = parseFloat(feeTrucking)   || 0
    const container  = parseFloat(feeContainer)  || 0
    const bankAmt    = base * (parseFloat(feeBankPct) || 0) / 100
    const port       = parseFloat(feePort)        || 0
    const wire       = parseFloat(feeWire)        || 0
    const commission = parseFloat(feeCommission)  || 0
    const other      = parseFloat(feeOtherAmt)    || 0
    const totalDeduction = customs + trucking + container + bankAmt + port + wire + commission + other
    const netPayable = base - totalDeduction
    const vatAmt     = netPayable * (parseFloat(feeVatPct) || 0) / 100
    const finalWire  = netPayable + vatAmt
    return { customs, trucking, container, bankAmt, port, wire, commission, other, totalDeduction, netPayable, vatAmt, finalWire }
  }

  function openPayDialog(p: Payable) {
    setPayDialog(p)
    setPayInput(p.finalWireAmountTWD ? p.finalWireAmountTWD : p.amountTWD)
    setPayDateInput('')
    setPayNote(p.note ?? '')
    // 預填已存的費用明細
    setFeeCustoms(p.customsFeeTWD      ? String(Number(p.customsFeeTWD))      : '')
    setFeeTrucking(p.truckingFeeTWD    ? String(Number(p.truckingFeeTWD))     : '')
    setFeeContainer(p.containerFeeTWD  ? String(Number(p.containerFeeTWD))    : '')
    setFeeBankPct(p.bankFeePct         ? String(Number(p.bankFeePct))          : '')
    setFeePort(p.portServiceFeeTWD     ? String(Number(p.portServiceFeeTWD))   : '')
    setFeeWire(p.wireTransferFeeTWD    ? String(Number(p.wireTransferFeeTWD))  : '')
    setFeeCommission(p.commissionTWD   ? String(Number(p.commissionTWD))       : '')
    setFeeOtherAmt(p.otherAdjustmentTWD ? String(Number(p.otherAdjustmentTWD)) : '')
    setFeeOtherNote(p.otherAdjustmentNote ?? '')
    setFeeVatPct(p.vatPct              ? String(Number(p.vatPct))              : '5')
    setShowFeePanel(false)
  }

  async function submitPay() {
    if (!payDialog) return
    setSaving(true)
    const base = Number(payDialog.amountTWD)
    const fees = calcFees(base)
    await fetch(`/api/finance/payables/${payDialog.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // 費用明細
        customsFeeTWD:      feeCustoms      ? Number(feeCustoms)   : null,
        truckingFeeTWD:     feeTrucking     ? Number(feeTrucking)  : null,
        containerFeeTWD:    feeContainer    ? Number(feeContainer) : null,
        bankFeePct:         feeBankPct      ? Number(feeBankPct)   : null,
        portServiceFeeTWD:  feePort         ? Number(feePort)      : null,
        wireTransferFeeTWD: feeWire         ? Number(feeWire)      : null,
        commissionTWD:      feeCommission   ? Number(feeCommission): null,
        otherAdjustmentTWD:  feeOtherAmt   ? Number(feeOtherAmt)  : null,
        otherAdjustmentNote: feeOtherNote  || null,
        vatPct:              feeVatPct      ? Number(feeVatPct)    : null,
        finalWireAmountTWD:  fees.finalWire > 0 ? fees.finalWire   : null,
        // 付款記錄
        paidAmountTWD: Number(payInput),
        paidAt:  payDateInput || undefined,
        note:    payNote      || undefined,
      }),
    })
    setSaving(false)
    setPayDialog(null)
    load()
  }

  async function submitRec() {
    if (!recDialog) return
    setSaving(true)
    await fetch(`/api/finance/receivables/${recDialog.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collectedForeign: Number(recForeign),
        rateAtCollection: Number(recRate),
        collectedAt: recDateInput || undefined,
        note: recNote || undefined,
      }),
    })
    setSaving(false)
    setRecDialog(null)
    load()
  }

  // 新記錄 amountTWD 是台幣，舊記錄（currencyCode='TWD'）amountForeign 才是台幣
  const rTWD = (r: Receivable) => Number(r.amountTWD ?? r.amountForeign)

  // 摘要數字
  const totalPayable = payables.filter(p => p.status < 2).reduce((s, p) => s + Number(p.amountTWD) - Number(p.paidAmountTWD ?? 0), 0)
  const totalReceivable = receivables.filter(r => r.status < 2).reduce((s, r) => s + rTWD(r) - Number(r.collectedForeign ?? 0), 0)
  const totalFxGainLoss = receivables.filter(r => r.fxGainLoss).reduce((s, r) => s + Number(r.fxGainLoss ?? 0), 0)

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-xl font-semibold">對帳 / 付款</h1>
        <button
          onClick={handleBackfill}
          disabled={backfilling}
          className="text-sm border border-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-50 disabled:opacity-50 text-gray-600"
        >
          {backfilling ? '補建中…' : '⟳ 從出貨文件補建帳款'}
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-3">追蹤應付帳款（供應商）與應收帳款（客戶）</p>

      {backfillResult && (
        <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">
          <span>
            補建完成：應收 +{backfillResult.ar.created} 筆（略過 {backfillResult.ar.skipped} 筆）、
            應付 +{backfillResult.ap.created} 筆（略過 {backfillResult.ap.skipped} 筆）
          </span>
          <button onClick={() => setBackfillResult(null)} className="ml-4 text-blue-400 hover:text-blue-600">×</button>
        </div>
      )}

      {/* 摘要 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-xs text-red-500 font-medium">待付供應商</p>
          <p className="text-2xl font-bold text-red-700 mt-1">TWD {fmt(String(totalPayable), 0)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs text-blue-500 font-medium">待收客戶款</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">TWD {fmt(String(totalReceivable), 0)}</p>
        </div>
        <div className={`border rounded-lg p-4 ${totalFxGainLoss >= 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className={`text-xs font-medium ${totalFxGainLoss >= 0 ? 'text-green-600' : 'text-amber-600'}`}>本期匯差（已收款）</p>
          <p className={`text-2xl font-bold mt-1 ${totalFxGainLoss >= 0 ? 'text-green-700' : 'text-amber-700'}`}>
            TWD {totalFxGainLoss >= 0 ? '+' : ''}{fmt(String(totalFxGainLoss), 0)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => switchTab('pay')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'pay' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
          應付帳款
        </button>
        <button onClick={() => switchTab('rec')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'rec' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
          應收帳款
        </button>
        <button onClick={() => switchTab('est')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'est' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
          毛利估算
        </button>
      </div>

      {tab === 'est' ? (
        <EstimatesTab estimates={estimates} loaded={estimatesLoaded} onRefresh={() => { setEstimatesLoaded(false); loadEstimates() }} />
      ) : loading ? <div className="text-sm text-gray-400">載入中…</div> : tab === 'pay' ? (
        <>
          <div className="flex gap-2 mb-3">
            {['', '0', '1', '2'].map(v => (
              <button key={v} onClick={() => setPayFilter(v)}
                className={`px-3 py-1 rounded text-xs font-medium border ${payFilter === v ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                {v === '' ? '全部' : STATUS_PAY[Number(v)]}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">供應商</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">供應商訂單</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">入庫日</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">到期日</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">應付 (TWD)</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">已付 (TWD)</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">狀態</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payables.map(p => {
                  const overdue = isOverdue(p.dueDate, p.status)
                  const soon = isDueSoon(p.dueDate, p.status)
                  return (
                    <tr key={p.id} className={overdue ? 'bg-red-50' : ''}>
                      <td className="px-4 py-3">
                        <Link href={`/suppliers/${p.supplier.id}`} className="font-medium text-gray-800 hover:underline">
                          {p.supplier.shortName ?? p.supplier.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/purchases/${p.receipt.order.id}`} className="font-mono text-blue-600 hover:underline text-xs">
                          {p.receipt.order.poNo}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(p.receipt.performedAt)}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={overdue ? 'text-red-600 font-medium' : soon ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                          {fmtDate(p.dueDate)}{overdue ? ' ⚠ 逾期' : soon ? ' ⚡ 即將到期' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(p.amountTWD)}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-700">{p.paidAmountTWD ? fmt(p.paidAmountTWD) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_PAY_COLOR[p.status]}`}>{STATUS_PAY[p.status]}</span>
                      </td>
                      <td className="px-4 py-3">
                        {p.status < 2 && (
                          <button onClick={() => openPayDialog(p)}
                            className="text-xs text-blue-600 hover:underline">記錄付款</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {payables.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">無資料</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="flex gap-2 mb-3">
            {['', '0', '1', '2'].map(v => (
              <button key={v} onClick={() => setRecFilter(v)}
                className={`px-3 py-1 rounded text-xs font-medium border ${recFilter === v ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                {v === '' ? '全部' : STATUS_REC[Number(v)]}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">客戶</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">客戶訂單</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">出貨日</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">到期日</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">應收 (TWD)</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">報帳匯率</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">押匯匯率</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">匯差 (TWD)</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">狀態</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {receivables.map(r => {
                  const overdue = isOverdue(r.dueDate, r.status)
                  const soon = isDueSoon(r.dueDate, r.status)
                  const custName = r.customer?.shortName ?? r.customer?.name ?? r.customerName ?? '—'
                  return (
                    <tr key={r.id} className={overdue ? 'bg-red-50' : ''}>
                      <td className="px-4 py-3">
                        {r.customer ? (
                          <Link href={`/customers/${r.customer.id}`} className="font-medium text-gray-800 hover:underline">{custName}</Link>
                        ) : <span className="text-gray-600">{custName}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {r.shipment.pis.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {r.shipment.pis.map(sp => (
                              <Link key={sp.pi.id} href={`/sales/${sp.pi.order.id}`}
                                className="font-mono text-blue-600 hover:underline text-xs">
                                {sp.pi.piNo}
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(r.shipment.actualShipDate)}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={overdue ? 'text-red-600 font-medium' : soon ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                          {fmtDate(r.dueDate)}{overdue ? ' ⚠ 逾期' : soon ? ' ⚡ 即將到期' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(String(rTWD(r)), 0)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{fmt(r.rateAtInvoice, 4)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{r.rateAtCollection ? fmt(r.rateAtCollection, 4) : '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {r.fxGainLoss ? (
                          <span className={Number(r.fxGainLoss) >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {Number(r.fxGainLoss) >= 0 ? '+' : ''}{fmt(r.fxGainLoss, 0)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_REC_COLOR[r.status]}`}>{STATUS_REC[r.status]}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.status < 2 && (
                          <div className="flex flex-col items-end gap-1">
                            <button onClick={() => { setRecDialog(r); setRecForeign((Number(r.amountForeign) * Number(r.rateAtInvoice)).toFixed(2)); setRecRate(''); setRecDateInput(''); setRecNote(r.note ?? '') }}
                              className="text-xs text-blue-600 hover:underline">記錄收款</button>
                            {r.status === 0 && !r.rateAtCollection && (
                              <span className="text-xs text-amber-500" title="收款後請填入銀行押匯匯率以計算匯差">
                                待填押匯匯率
                              </span>
                            )}
                          </div>
                        )}
                        {r.status === 2 && !r.rateAtCollection && (
                          <span className="text-xs text-gray-400" title="已收款但未記錄押匯匯率，無法計算匯差">
                            未記錄匯率
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {receivables.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">無資料</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 付款對話框 */}
      {payDialog && (() => {
        const base = Number(payDialog.amountTWD)
        const fees = calcFees(base)
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
              {/* 標題 */}
              <div className="px-6 pt-5 pb-3 border-b border-gray-100">
                <h2 className="text-base font-semibold">記錄付款 — 台灣出貨明細</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {payDialog.supplier.shortName ?? payDialog.supplier.name}
                  <span className="mx-1 text-gray-300">·</span>
                  <span className="font-mono text-xs text-gray-500">{payDialog.receipt.order.poNo}</span>
                  <span className="mx-1 text-gray-300">·</span>
                  入庫 {fmtDate(payDialog.receipt.performedAt)}
                </p>
              </div>

              <div className="px-6 py-4 space-y-4">
                {/* 基本金額 */}
                <div className="bg-blue-50 rounded-lg px-4 py-3 flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-800">採購金額（TWD）</span>
                  <span className="font-mono text-base font-bold text-blue-900">{fmt(payDialog.amountTWD)}</span>
                </div>

                {/* 費用明細區塊（可折疊） */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowFeePanel(!showFeePanel)}
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    <span className={`transition-transform ${showFeePanel ? 'rotate-90' : ''}`}>▶</span>
                    費用明細（報關費、拖車費等）
                    {(feeCustoms || feeTrucking || feeContainer || feeBankPct || feePort || feeWire || feeCommission || feeOtherAmt) && (
                      <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">已填寫</span>
                    )}
                  </button>

                  {showFeePanel && (
                    <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray-100">
                          {[
                            { label: '報關費', state: feeCustoms,    setter: setFeeCustoms,    unit: 'TWD', placeholder: '0' },
                            { label: '拖車費', state: feeTrucking,   setter: setFeeTrucking,   unit: 'TWD', placeholder: '0' },
                            { label: '吊櫃費', state: feeContainer,  setter: setFeeContainer,  unit: 'TWD', placeholder: '0' },
                            { label: '銀行費', state: feeBankPct,    setter: setFeeBankPct,    unit: '%',   placeholder: '0.7' },
                            { label: '商港費', state: feePort,       setter: setFeePort,       unit: 'TWD', placeholder: '0' },
                            { label: '電匯費', state: feeWire,       setter: setFeeWire,       unit: 'TWD', placeholder: '0' },
                            { label: '佣金',   state: feeCommission, setter: setFeeCommission, unit: 'TWD', placeholder: '0' },
                          ].map(({ label, state, setter, unit, placeholder }) => (
                            <tr key={label} className="bg-white hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-600 w-24">{label}</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={state}
                                    onChange={e => setter(e.target.value)}
                                    placeholder={placeholder}
                                    className="w-full border border-gray-200 rounded px-2 py-1 text-right text-sm font-mono focus:outline-none focus:border-blue-400"
                                  />
                                  <span className="text-xs text-gray-400 w-8 shrink-0">{unit}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-gray-500 text-xs w-28">
                                {unit === '%'
                                  ? (feeBankPct ? `≈ ${(base * parseFloat(feeBankPct) / 100).toFixed(0)}` : '—')
                                  : (state ? `− ${fmt(state, 0)}` : '—')
                                }
                              </td>
                            </tr>
                          ))}
                          {/* 其他調整 */}
                          <tr className="bg-white hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-600 w-24">其他調整</td>
                            <td className="px-3 py-2" colSpan={2}>
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  value={feeOtherAmt}
                                  onChange={e => setFeeOtherAmt(e.target.value)}
                                  placeholder="0"
                                  className="w-32 border border-gray-200 rounded px-2 py-1 text-right text-sm font-mono focus:outline-none focus:border-blue-400"
                                />
                                <span className="text-xs text-gray-400 self-center">TWD</span>
                                <input
                                  type="text"
                                  value={feeOtherNote}
                                  onChange={e => setFeeOtherNote(e.target.value)}
                                  placeholder="說明…"
                                  className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                                />
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      {/* 小計 */}
                      <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 flex justify-between text-xs text-gray-600">
                        <span>扣款小計</span>
                        <span className="font-mono text-red-600">− {fees.totalDeduction.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 計算結果 */}
                <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="px-4 py-2 text-gray-600">採購金額</td>
                        <td className="px-4 py-2 text-right font-mono">{fmt(payDialog.amountTWD)}</td>
                      </tr>
                      {fees.totalDeduction > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-gray-600">合計扣款</td>
                          <td className="px-4 py-2 text-right font-mono text-red-600">− {fees.totalDeduction.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="px-4 py-2 text-gray-600">扣款後淨額</td>
                        <td className="px-4 py-2 text-right font-mono font-medium">{fees.netPayable.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-600">
                          <div className="flex items-center gap-2">
                            <span>加計營業稅</span>
                            <input
                              type="number"
                              value={feeVatPct}
                              onChange={e => setFeeVatPct(e.target.value)}
                              className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-center text-xs font-mono focus:outline-none focus:border-blue-400"
                            />
                            <span className="text-xs text-gray-400">%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-green-600">
                          + {fees.vatAmt.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                      <tr className="bg-blue-50">
                        <td className="px-4 py-2.5 font-semibold text-blue-800">應付匯款金額</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-blue-900 text-base">
                          {fees.finalWire.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 付款輸入 */}
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      實付金額（TWD）
                      {fees.finalWire > 0 && (
                        <button type="button" onClick={() => setPayInput(String(Math.round(fees.finalWire)))}
                          className="ml-2 text-blue-600 underline">帶入計算值</button>
                      )}
                    </label>
                    <input
                      type="number"
                      value={payInput}
                      onChange={e => setPayInput(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">付款日期</label>
                    <input type="date" value={payDateInput} onChange={e => setPayDateInput(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">備註</label>
                    <input type="text" value={payNote} onChange={e => setPayNote(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="匯款帳號、備忘…" />
                  </div>
                </div>
              </div>

              <div className="px-6 pb-5 flex justify-end gap-2">
                <button onClick={() => setPayDialog(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">取消</button>
                <button onClick={submitPay} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                  {saving ? '儲存中…' : '確認付款'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 收款對話框 */}
      {recDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96">
            <h2 className="text-base font-semibold mb-1">記錄收款</h2>
            <p className="text-sm text-gray-500 mb-4">
              {recDialog.customer?.name ?? recDialog.customerName}
              {recDialog.shipment.pis.length > 0 && (
                <span className="ml-1 text-gray-500">— {recDialog.shipment.pis.map(sp => sp.pi.piNo).join(' / ')}</span>
              )}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">實收歐元金額（EUR）</label>
                <input type="number" step="0.01" value={recForeign} onChange={e => setRecForeign(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                <p className="text-xs text-gray-400 mt-1">
                  CI 報帳：TWD {fmt(String(rTWD(recDialog)), 0)} × {fmt(recDialog.rateAtInvoice, 4)} = EUR {(rTWD(recDialog) * Number(recDialog.rateAtInvoice)).toFixed(2)}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">押匯匯率（EUR → TWD）</label>
                <input type="number" step="0.0001" value={recRate} onChange={e => setRecRate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="如：36.00" />
                <p className="text-xs text-gray-400 mt-1">報帳匯率（TWD→EUR）：{fmt(recDialog.rateAtInvoice, 4)}，倒算 EUR→TWD ≈ {recDialog.rateAtInvoice ? (1 / Number(recDialog.rateAtInvoice)).toFixed(2) : '—'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">收款日期</label>
                <input type="date" value={recDateInput} onChange={e => setRecDateInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">備註</label>
                <input type="text" value={recNote} onChange={e => setRecNote(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="押匯銀行、備忘…" />
              </div>
              {recForeign && recRate && (
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  <div>實收台幣：TWD {(Number(recForeign) * Number(recRate)).toFixed(0)}</div>
                  <div>原始應收：TWD {fmt(String(rTWD(recDialog)), 0)}</div>
                  <div className={Number(recForeign) * Number(recRate) >= rTWD(recDialog) ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                    匯差：TWD {(Number(recForeign) * Number(recRate) - rTWD(recDialog)).toFixed(0)}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setRecDialog(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">取消</button>
              <button onClick={submitRec} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {saving ? '儲存中…' : '確認收款'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EstimatesTab({
  estimates, loaded, onRefresh,
}: {
  estimates: EstimateRow[]
  loaded: boolean
  onRefresh: () => void
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const totalArTWD = estimates.reduce((s, r) => s + r.ar.twd, 0)
  const totalApTWD = estimates.reduce((s, r) => s + r.ap.twd, 0)
  const totalGross = totalArTWD - totalApTWD
  const avgGrossPct = totalArTWD > 0 ? (totalGross / totalArTWD) * 100 : 0

  return (
    <div>
      {/* 摘要 */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs text-blue-500 font-medium">估算應收合計（TWD）</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{totalArTWD.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-xs text-amber-500 font-medium">估算應付合計（TWD）</p>
          <p className="text-xl font-bold text-amber-700 mt-1">{totalApTWD.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className={`border rounded-lg p-4 ${totalGross >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-xs font-medium ${totalGross >= 0 ? 'text-green-600' : 'text-red-600'}`}>估算毛利合計（TWD）</p>
          <p className={`text-xl font-bold mt-1 ${totalGross >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {totalGross >= 0 ? '+' : ''}{totalGross.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 font-medium">平均毛利率</p>
          <p className="text-xl font-bold text-gray-700 mt-1">{avgGrossPct.toFixed(1)}%</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400">以出貨單為基準，從銷售訂單→採購訂單鏈估算。無採購訂單連結的出貨顯示為「—」。</p>
        <button onClick={onRefresh} className="text-xs text-blue-600 hover:underline">{loaded ? '重新載入' : '載入中…'}</button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">出貨單號</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">客戶</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">出貨日</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">估算應收 (TWD)</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">估算應付 (TWD)</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">毛利 (TWD)</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">毛利率</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">供應商</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!loaded && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">載入中…</td></tr>
            )}
            {loaded && estimates.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">無出貨資料</td></tr>
            )}
            {estimates.map(r => {
              const grossColor = r.gross.twd >= 0 ? 'text-green-700' : 'text-red-600'
              const hasWarning = r.warnings.length > 0
              const isExpanded = expandedId === r.shipmentId
              return (
                <>
                  <tr key={r.shipmentId}
                    className={`hover:bg-gray-50 cursor-pointer ${hasWarning ? 'bg-amber-50/40' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : r.shipmentId)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">
                      <span className="flex items-center gap-1">
                        <span className="text-gray-400 text-xs">{isExpanded ? '▼' : '▶'}</span>
                        <Link href={`/shipments/${r.shipmentId}`} className="hover:underline" onClick={e => e.stopPropagation()}>{r.shipmentNo}</Link>
                        {hasWarning && <span title={r.warnings.join('\n')} className="text-amber-500">⚠️</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs">
                      {r.customer.id
                        ? <Link href={`/customers/${r.customer.id}`} className="hover:underline">{r.customer.name}</Link>
                        : <span className="text-gray-400">{r.customer.name}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(r.actualShipDate)}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span title={`${r.ar.foreign.toFixed(2)} ${r.ar.currency} × ${r.ar.rate}`}>
                        {r.ar.twd > 0 ? r.ar.twd.toLocaleString('zh-TW', { maximumFractionDigits: 0 }) : '—'}
                      </span>
                      {r.ar.fromRecord && <span className="ml-1 text-xs text-gray-400">✓</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.ap.twd > 0 ? r.ap.twd.toLocaleString('zh-TW', { maximumFractionDigits: 0 }) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${r.ap.twd > 0 ? grossColor : 'text-gray-300'}`}>
                      {r.ap.twd > 0
                        ? `${r.gross.twd >= 0 ? '+' : ''}${r.gross.twd.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}`
                        : '—'}
                    </td>
                    <td className={`px-4 py-3 text-right text-xs ${r.ap.twd > 0 ? grossColor : 'text-gray-300'}`}>
                      {r.gross.pct != null && r.ap.twd > 0 ? `${r.gross.pct.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {r.ap.items.length > 0
                        ? r.ap.items.map(i => i.supplierName).join('、')
                        : <span className="text-gray-300">無採購訂單連結</span>}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${r.shipmentId}-detail`} className="bg-gray-50">
                      <td colSpan={8} className="px-6 py-4 text-xs">
                        <div className="grid grid-cols-2 gap-6">
                          {/* AR 明細 */}
                          <div>
                            <p className="font-semibold text-blue-700 mb-2">應收明細（AR）</p>
                            {r.ar.fromRecord
                              ? <p className="text-gray-600">來源：FIN_Receivable 記錄 → TWD {r.ar.twd.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</p>
                              : <p className="text-gray-600">來源：PI 訂單加總 + HC → TWD {r.ar.twd.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</p>
                            }
                            <p className="text-gray-400 mt-1">CI 匯率：1 TWD = {r.ar.rate > 0 ? (1/r.ar.rate).toFixed(4) : '—'} EUR</p>
                          </div>
                          {/* AP 明細 */}
                          <div>
                            <p className="font-semibold text-amber-700 mb-2">應付明細（AP）</p>
                            {r.ap.items.length > 0 ? (
                              <table className="w-full text-xs mb-2">
                                <thead><tr className="text-gray-400">
                                  <th className="text-left pb-1">PO 號</th>
                                  <th className="text-left pb-1">供應商</th>
                                  <th className="text-right pb-1">TWD</th>
                                  <th className="text-left pb-1 pl-2">配對方式</th>
                                </tr></thead>
                                <tbody>{r.ap.items.map((item, i) => (
                                  <tr key={i} className="border-t border-gray-100">
                                    <td className="py-1 font-mono">{item.poNo}</td>
                                    <td className="py-1 pl-2">{item.supplierName}</td>
                                    <td className="py-1 text-right font-mono">{item.amountTWD > 0 ? item.amountTWD.toLocaleString('zh-TW', { maximumFractionDigits: 0 }) : <span className="text-red-400">無金額</span>}</td>
                                    <td className="py-1 pl-2 text-gray-400">{item.matchType === 'linked' ? '直連' : '單號配對'}</td>
                                  </tr>
                                ))}</tbody>
                              </table>
                            ) : <p className="text-gray-400 mb-2">無配對的 PO</p>}
                            {/* 警告 */}
                            {r.unmatchedOrders.length > 0 && (
                              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
                                <p className="font-medium text-amber-700 mb-1">⚠ 找不到 PO 的訂單（成本缺失）</p>
                                {r.unmatchedOrders.map(o => <p key={o} className="text-amber-600 font-mono">{o}</p>)}
                              </div>
                            )}
                            {r.nullAmountPos.length > 0 && (
                              <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded">
                                <p className="font-medium text-orange-700 mb-1">⚠ PO 已配對但金額為空</p>
                                {r.nullAmountPos.map(o => <p key={o} className="text-orange-600 font-mono">{o}</p>)}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
