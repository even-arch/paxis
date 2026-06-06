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
  shipment: { shipmentNo: string; actualShipDate: string; order: { id: number; orderNo: string } }
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

export default function FinancePage() {
  const [tab, setTab] = useState<'pay' | 'rec'>('pay')
  const [payFilter, setPayFilter] = useState('')
  const [recFilter, setRecFilter] = useState('')
  const [payables, setPayables] = useState<Payable[]>([])
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [loading, setLoading] = useState(true)

  // 付款對話框
  const [payDialog, setPayDialog] = useState<Payable | null>(null)
  const [payInput, setPayInput] = useState('')
  const [payDateInput, setPayDateInput] = useState('')
  const [payNote, setPayNote] = useState('')
  const [saving, setSaving] = useState(false)

  // 收款對話框
  const [recDialog, setRecDialog] = useState<Receivable | null>(null)
  const [recForeign, setRecForeign] = useState('')
  const [recRate, setRecRate] = useState('')
  const [recDateInput, setRecDateInput] = useState('')
  const [recNote, setRecNote] = useState('')

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

  async function submitPay() {
    if (!payDialog) return
    setSaving(true)
    await fetch(`/api/finance/payables/${payDialog.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paidAmountTWD: Number(payInput), paidAt: payDateInput || undefined, note: payNote || undefined }),
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

  // 摘要數字
  const totalPayable = payables.filter(p => p.status < 2).reduce((s, p) => s + Number(p.amountTWD) - Number(p.paidAmountTWD ?? 0), 0)
  const totalReceivable = receivables.filter(r => r.status < 2).reduce((s, r) => s + Number(r.amountForeign) - Number(r.collectedForeign ?? 0), 0)
  const totalFxGainLoss = receivables.filter(r => r.fxGainLoss).reduce((s, r) => s + Number(r.fxGainLoss ?? 0), 0)
  const recCurrency = receivables[0]?.currencyCode ?? 'EUR'

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-1">對帳 / 付款</h1>
      <p className="text-sm text-gray-500 mb-5">追蹤應付帳款（供應商）與應收帳款（客戶）</p>

      {/* 摘要 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-xs text-red-500 font-medium">待付供應商</p>
          <p className="text-2xl font-bold text-red-700 mt-1">TWD {fmt(String(totalPayable), 0)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs text-blue-500 font-medium">待收客戶款</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{recCurrency} {fmt(String(totalReceivable), 2)}</p>
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
        <button onClick={() => setTab('pay')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'pay' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
          應付帳款
        </button>
        <button onClick={() => setTab('rec')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'rec' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
          應收帳款
        </button>
      </div>

      {loading ? <div className="text-sm text-gray-400">載入中…</div> : tab === 'pay' ? (
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
                          <button onClick={() => { setPayDialog(p); setPayInput(p.paidAmountTWD ? String(Number(p.amountTWD)) : String(Number(p.amountTWD))); setPayDateInput(''); setPayNote(p.note ?? '') }}
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
                  <th className="text-right px-4 py-3 font-medium text-gray-600">應收 (EUR)</th>
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
                        <Link href={`/sales/${r.shipment.order.id}`} className="font-mono text-blue-600 hover:underline text-xs">
                          {r.shipment.order.orderNo}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(r.shipment.actualShipDate)}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={overdue ? 'text-red-600 font-medium' : soon ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                          {fmtDate(r.dueDate)}{overdue ? ' ⚠ 逾期' : soon ? ' ⚡ 即將到期' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(r.amountForeign, 2)}</td>
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
                      <td className="px-4 py-3">
                        {r.status < 2 && (
                          <button onClick={() => { setRecDialog(r); setRecForeign(String(Number(r.amountForeign))); setRecRate(r.rateAtInvoice); setRecDateInput(''); setRecNote(r.note ?? '') }}
                            className="text-xs text-blue-600 hover:underline">記錄收款</button>
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
      {payDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96">
            <h2 className="text-base font-semibold mb-1">記錄付款</h2>
            <p className="text-sm text-gray-500 mb-4">{payDialog.supplier.name} — {payDialog.receipt.order.poNo}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">付款金額（TWD）</label>
                <input type="number" value={payInput} onChange={e => setPayInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                <p className="text-xs text-gray-400 mt-1">應付總額：TWD {fmt(payDialog.amountTWD)}</p>
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
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setPayDialog(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">取消</button>
              <button onClick={submitPay} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {saving ? '儲存中…' : '確認付款'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 收款對話框 */}
      {recDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96">
            <h2 className="text-base font-semibold mb-1">記錄收款</h2>
            <p className="text-sm text-gray-500 mb-4">
              {recDialog.customer?.name ?? recDialog.customerName} — {recDialog.shipment.order.orderNo}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">實收金額（{recDialog.currencyCode}）</label>
                <input type="number" step="0.01" value={recForeign} onChange={e => setRecForeign(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                <p className="text-xs text-gray-400 mt-1">應收：{recDialog.currencyCode} {fmt(recDialog.amountForeign, 2)}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">押匯匯率（{recDialog.currencyCode}/TWD）</label>
                <input type="number" step="0.0001" value={recRate} onChange={e => setRecRate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                <p className="text-xs text-gray-400 mt-1">報帳匯率：{fmt(recDialog.rateAtInvoice, 4)}</p>
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
                  預估匯差：TWD {(Number(recForeign) * Number(recRate) - Number(recForeign) * Number(recDialog.rateAtInvoice)).toFixed(0)}
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
