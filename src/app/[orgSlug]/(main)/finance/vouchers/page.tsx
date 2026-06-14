'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Supplier = { id: number; name: string; shortName: string | null }
type Payable = {
  id: number
  supplierId: number
  amountTWD: string
  status: number
  dueDate: string | null
  note: string | null
  receipt: {
    id?: number
    receiptNo?: string
    performedAt?: string
    order: { id: number; poNo: string } | null
  }
  voucherItem: null | { id: number }
}
type Adjustment = { name: string; amountTWD: number; category: string; note: string }
type VoucherItem = {
  id: number
  payableId: number
  amountTWD: string
  payable: Payable
}
type VoucherAdjustment = {
  id: number
  name: string
  amountTWD: string
  category: string
  note: string | null
}
type Voucher = {
  id: number
  voucherNo: string
  supplierId: number
  status: string
  vatPct: string
  note: string | null
  createdAt: string
  sentAt: string | null
  confirmedAt: string | null
  paidAt: string | null
  supplier: Supplier
  items: VoucherItem[]
  adjustments: VoucherAdjustment[]
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  SENT: '已傳送',
  CONFIRMED: '供應商確認',
  PAID: '已付款',
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-green-100 text-green-700',
}
const ADJ_CATEGORY: Record<string, string> = {
  LOGISTICS: '物流費用',
  PASSTHROUGH: '代墊費用',
  FORMULA: '計算平攤',
  TAX: '稅款',
  OTHER: '其他',
}

function fmt(n: string | number) {
  return Number(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function VouchersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null)
  const [payables, setPayables] = useState<Payable[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])

  // 新建 voucher 的狀態
  const [creating, setCreating] = useState(false)
  const [selectedPayableIds, setSelectedPayableIds] = useState<number[]>([])
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])
  const [vatPct, setVatPct] = useState(5)
  const [newNote, setNewNote] = useState('')

  // 調整輸入暫存
  const [adjForm, setAdjForm] = useState({ name: '', amountTWD: '', category: 'OTHER', note: '' })

  // 檢視 voucher
  const [viewVoucher, setViewVoucher] = useState<Voucher | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/suppliers?limit=200')
      .then(r => r.json())
      .then(d => setSuppliers(d.suppliers ?? []))
  }, [])

  const loadForSupplier = useCallback(async (supplierId: number) => {
    const [payRes, voucherRes] = await Promise.all([
      fetch(`/api/finance/payables?supplierId=${supplierId}&status=0&limit=200`),
      fetch(`/api/finance/payment-vouchers?supplierId=${supplierId}`),
    ])
    const payData = await payRes.json()
    const voucherData = await voucherRes.json()
    setPayables(payData.payables ?? payData ?? [])
    setVouchers(voucherData)
  }, [])

  useEffect(() => {
    if (selectedSupplierId) {
      setSelectedPayableIds([])
      setAdjustments([])
      setCreating(false)
      setViewVoucher(null)
      loadForSupplier(selectedSupplierId)
    }
  }, [selectedSupplierId, loadForSupplier])

  // 計算金額
  const itemsTotal = selectedPayableIds.reduce((sum, id) => {
    const p = payables.find(p => p.id === id)
    return sum + (p ? Number(p.amountTWD) : 0)
  }, 0)
  const adjTotal = adjustments.reduce((sum, a) => sum + Number(a.amountTWD), 0)
  const subtotal = itemsTotal + adjTotal
  const vatAmount = subtotal * vatPct / 100
  const finalAmount = subtotal + vatAmount

  // 計算已建 voucher 的金額
  function voucherSubtotal(v: Voucher) {
    const items = v.items.reduce((s, i) => s + Number(i.amountTWD), 0)
    const adjs = v.adjustments.reduce((s, a) => s + Number(a.amountTWD), 0)
    return items + adjs
  }
  function voucherFinal(v: Voucher) {
    const sub = voucherSubtotal(v)
    return sub + sub * Number(v.vatPct) / 100
  }

  async function createVoucher() {
    if (!selectedSupplierId || selectedPayableIds.length === 0) return
    setSaving(true)
    const res = await fetch('/api/finance/payment-vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: selectedSupplierId,
        payableIds: selectedPayableIds,
        adjustments,
        vatPct,
        note: newNote || null,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const err = await res.json()
      setMsg(err.error ?? '建立失敗')
      return
    }
    setCreating(false)
    setSelectedPayableIds([])
    setAdjustments([])
    setNewNote('')
    loadForSupplier(selectedSupplierId)
  }

  async function updateStatus(id: number, status: string) {
    setSaving(true)
    const res = await fetch(`/api/finance/payment-vouchers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      setVouchers(prev => prev.map(v => v.id === id ? updated : v))
      if (viewVoucher?.id === id) setViewVoucher(updated)
      if (status === 'PAID' && selectedSupplierId) loadForSupplier(selectedSupplierId)
    }
  }

  async function deleteVoucher(id: number) {
    if (!confirm('確定要刪除這張付款通知單嗎？')) return
    await fetch(`/api/finance/payment-vouchers/${id}`, { method: 'DELETE' })
    setVouchers(prev => prev.filter(v => v.id !== id))
    if (viewVoucher?.id === id) setViewVoucher(null)
    if (selectedSupplierId) loadForSupplier(selectedSupplierId)
  }

  function addAdjustment() {
    if (!adjForm.name || !adjForm.amountTWD) return
    setAdjustments(prev => [...prev, { ...adjForm, amountTWD: Number(adjForm.amountTWD) }])
    setAdjForm({ name: '', amountTWD: '', category: 'OTHER', note: '' })
  }

  const availablePayables = payables.filter(p => p.status !== 2 && !p.voucherItem)

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-sm text-gray-400 hover:text-gray-600">← 財務</Link>
        <h1 className="text-xl font-semibold">付款通知單</h1>
      </div>
      <p className="text-sm text-gray-500">合併同一供應商的多張應付帳款，產生付款確認文件</p>

      {msg && <p className="text-sm text-red-500">{msg}</p>}

      {/* 選供應商 */}
      <div className="bg-white rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">選擇供應商</label>
        <select
          className="w-full max-w-sm border border-gray-300 rounded-md px-3 py-2 text-sm"
          value={selectedSupplierId ?? ''}
          onChange={e => setSelectedSupplierId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">請選擇供應商</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.shortName || s.name}</option>
          ))}
        </select>
      </div>

      {selectedSupplierId && (
        <>
          {/* 新建 Voucher */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">建立新付款通知單</h2>
              <button
                onClick={() => setCreating(c => !c)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {creating ? '收起' : '+ 新建'}
              </button>
            </div>

            {creating && (
              <div className="space-y-4">
                {/* 選 Payable */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">選擇要加入的應付帳款（未付款）</p>
                  {availablePayables.length === 0 ? (
                    <p className="text-sm text-gray-400">沒有可加入的未付款單據</p>
                  ) : (
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b">
                          <th className="text-left py-1 pr-2 w-6"></th>
                          <th className="text-left py-1 pr-4">採購單號</th>
                          <th className="text-left py-1 pr-4">入庫日</th>
                          <th className="text-right py-1">金額 (TWD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availablePayables.map(p => (
                          <tr key={p.id} className="border-b border-gray-50">
                            <td className="py-1.5 pr-2">
                              <input type="checkbox"
                                checked={selectedPayableIds.includes(p.id)}
                                onChange={e => setSelectedPayableIds(prev =>
                                  e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                                )}
                              />
                            </td>
                            <td className="py-1.5 pr-4 font-mono text-xs">{p.receipt?.order?.poNo ?? '—'}</td>
                            <td className="py-1.5 pr-4 text-gray-500">
                              {p.receipt?.performedAt ? new Date(p.receipt.performedAt).toLocaleDateString('zh-TW') : '—'}
                            </td>
                            <td className="py-1.5 text-right">{fmt(p.amountTWD)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* 調整項目 */}
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">調整項目（代墊費、扣款等）</p>
                  {adjustments.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm mb-1">
                      <span className="flex-1">{a.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500`}>{ADJ_CATEGORY[a.category]}</span>
                      <span className={Number(a.amountTWD) < 0 ? 'text-red-600' : 'text-green-600'}>
                        {Number(a.amountTWD) > 0 ? '+' : ''}{fmt(a.amountTWD)}
                      </span>
                      <button onClick={() => setAdjustments(prev => prev.filter((_, j) => j !== i))}
                        className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input placeholder="項目名稱（例：拖車費）" value={adjForm.name}
                      onChange={e => setAdjForm(p => ({ ...p, name: e.target.value }))}
                      className="border border-gray-300 rounded px-2 py-1 text-sm" />
                    <input type="number" placeholder="金額（負數=扣款）" value={adjForm.amountTWD}
                      onChange={e => setAdjForm(p => ({ ...p, amountTWD: e.target.value }))}
                      className="border border-gray-300 rounded px-2 py-1 text-sm" />
                    <select value={adjForm.category}
                      onChange={e => setAdjForm(p => ({ ...p, category: e.target.value }))}
                      className="border border-gray-300 rounded px-2 py-1 text-sm">
                      {Object.entries(ADJ_CATEGORY).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <button onClick={addAdjustment}
                      className="bg-gray-100 hover:bg-gray-200 rounded px-3 py-1 text-sm">+ 加入</button>
                  </div>
                </div>

                {/* 稅率 + 備註 */}
                <div className="flex gap-4 items-start">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">營業稅率 (%)</label>
                    <input type="number" value={vatPct} onChange={e => setVatPct(Number(e.target.value))}
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-20" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">備註</label>
                    <input value={newNote} onChange={e => setNewNote(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-full" />
                  </div>
                </div>

                {/* 小計預覽 */}
                {selectedPayableIds.length > 0 && (
                  <div className="bg-gray-50 rounded p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">入庫金額小計</span><span>{fmt(itemsTotal)}</span></div>
                    {adjustments.map((a, i) => (
                      <div key={i} className="flex justify-between text-gray-500">
                        <span>{a.name}</span>
                        <span className={Number(a.amountTWD) < 0 ? 'text-red-600' : ''}>{fmt(a.amountTWD)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t pt-1"><span className="text-gray-500">小計</span><span>{fmt(subtotal)}</span></div>
                    <div className="flex justify-between text-gray-400"><span>營業稅 {vatPct}%</span><span>{fmt(vatAmount)}</span></div>
                    <div className="flex justify-between font-semibold text-base border-t pt-1"><span>本次付款金額</span><span>NT$ {fmt(finalAmount)}</span></div>
                  </div>
                )}

                <button onClick={createVoucher} disabled={saving || selectedPayableIds.length === 0}
                  className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? '建立中...' : '建立付款通知單'}
                </button>
              </div>
            )}
          </div>

          {/* 歷史 Voucher 列表 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold text-gray-700">付款通知單記錄</h2>
            </div>
            {vouchers.length === 0 ? (
              <p className="text-sm text-gray-400 p-4">尚無記錄</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b">
                    <th className="text-left px-4 py-2">通知單號</th>
                    <th className="text-left px-4 py-2">狀態</th>
                    <th className="text-right px-4 py-2">小計 (TWD)</th>
                    <th className="text-right px-4 py-2">最終付款 (TWD)</th>
                    <th className="text-right px-4 py-2">建立日</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map(v => (
                    <tr key={v.id} className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => setViewVoucher(viewVoucher?.id === v.id ? null : v)}>
                      <td className="px-4 py-2.5 font-mono text-xs">{v.voucherNo}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[v.status]}`}>
                          {STATUS_LABEL[v.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">{fmt(voucherSubtotal(v))}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{fmt(voucherFinal(v))}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400">
                        {new Date(v.createdAt).toLocaleDateString('zh-TW')}
                      </td>
                      <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                        {v.status === 'DRAFT' && (
                          <button onClick={() => deleteVoucher(v.id)}
                            className="text-xs text-gray-400 hover:text-red-500">刪除</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 展開檢視 */}
          {viewVoucher && (
            <VoucherDetail
              voucher={viewVoucher}
              onStatusChange={status => updateStatus(viewVoucher.id, status)}
              saving={saving}
            />
          )}
        </>
      )}
    </div>
  )
}

function VoucherDetail({ voucher, onStatusChange, saving }: {
  voucher: Voucher
  onStatusChange: (s: string) => void
  saving: boolean
}) {
  const itemsTotal = voucher.items.reduce((s, i) => s + Number(i.amountTWD), 0)
  const adjTotal = voucher.adjustments.reduce((s, a) => s + Number(a.amountTWD), 0)
  const subtotal = itemsTotal + adjTotal
  const vatAmount = subtotal * Number(voucher.vatPct) / 100
  const finalAmount = subtotal + vatAmount

  const NEXT_STATUS: Record<string, { label: string; next: string }> = {
    DRAFT: { label: '標記為已傳送', next: 'SENT' },
    SENT: { label: '供應商已確認', next: 'CONFIRMED' },
    CONFIRMED: { label: '確認付款完成', next: 'PAID' },
  }
  const nextAction = NEXT_STATUS[voucher.status]

  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold">{voucher.voucherNo}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{voucher.supplier.name}</p>
        </div>
        <span className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_COLOR[voucher.status]}`}>
          {STATUS_LABEL[voucher.status]}
        </span>
      </div>

      {/* 單據明細 */}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-xs text-gray-500 border-b">
            <th className="text-left pb-1 pr-4">採購單號</th>
            <th className="text-left pb-1 pr-4">入庫日</th>
            <th className="text-right pb-1">金額 (TWD)</th>
          </tr>
        </thead>
        <tbody>
          {voucher.items.map(item => (
            <tr key={item.id} className="border-b border-gray-50">
              <td className="py-1.5 pr-4 font-mono text-xs">
                {item.payable.receipt?.order?.poNo ?? '—'}
              </td>
              <td className="py-1.5 pr-4 text-gray-500">
                {item.payable.receipt?.performedAt
                  ? new Date(item.payable.receipt.performedAt).toLocaleDateString('zh-TW')
                  : '—'}
              </td>
              <td className="py-1.5 text-right">{fmt(item.amountTWD)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 調整項目 */}
      {voucher.adjustments.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500">調整項目</p>
          {voucher.adjustments.map(a => (
            <div key={a.id} className="flex justify-between text-sm">
              <span className="text-gray-600">{a.name}
                <span className="ml-1 text-xs text-gray-400">({ADJ_CATEGORY[a.category] ?? a.category})</span>
              </span>
              <span className={Number(a.amountTWD) < 0 ? 'text-red-600' : 'text-gray-800'}>
                {Number(a.amountTWD) > 0 ? '+' : ''}{fmt(a.amountTWD)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 金額總結 */}
      <div className="bg-gray-50 rounded p-3 space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">入庫金額小計</span><span>{fmt(itemsTotal)}</span></div>
        {adjTotal !== 0 && <div className="flex justify-between"><span className="text-gray-500">調整合計</span><span className={adjTotal < 0 ? 'text-red-600' : ''}>{fmt(adjTotal)}</span></div>}
        <div className="flex justify-between border-t pt-1"><span className="text-gray-500">小計</span><span>{fmt(subtotal)}</span></div>
        <div className="flex justify-between text-gray-400"><span>營業稅 {voucher.vatPct}%</span><span>{fmt(vatAmount)}</span></div>
        <div className="flex justify-between font-bold text-base border-t pt-1">
          <span>本次付款金額</span>
          <span>NT$ {fmt(finalAmount)}</span>
        </div>
      </div>

      {/* 時間軸 */}
      <div className="text-xs text-gray-400 space-y-0.5">
        {voucher.sentAt && <div>傳送日：{new Date(voucher.sentAt).toLocaleString('zh-TW')}</div>}
        {voucher.confirmedAt && <div>供應商確認日：{new Date(voucher.confirmedAt).toLocaleString('zh-TW')}</div>}
        {voucher.paidAt && <div>付款日：{new Date(voucher.paidAt).toLocaleString('zh-TW')}</div>}
      </div>

      {/* 動作按鈕 */}
      {nextAction && (
        <div className="flex gap-3">
          <button
            onClick={() => onStatusChange(nextAction.next)}
            disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '更新中...' : nextAction.label}
          </button>
          {voucher.status === 'CONFIRMED' && (
            <button onClick={() => window.print()}
              className="border border-gray-300 text-gray-700 px-5 py-2 rounded-md text-sm hover:bg-gray-50">
              列印 / PDF
            </button>
          )}
        </div>
      )}

      {voucher.note && <p className="text-sm text-gray-500">備註：{voucher.note}</p>}
    </div>
  )
}
