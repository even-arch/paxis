'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import ShipmentPayablesPanel, { type SupplierPayable } from './ShipmentPayablesPanel'

// ─── Types ────────────────────────────────────────────────────────────────────

type FobCostItem = { id: number; name: string; amountTWD: number; note: string | null }

type ShipmentGroup = {
  id: number
  shipmentNo: string
  actualShipDate: string | null
  customerName: string | null
  fobCostItems: FobCostItem[]
  payables: SupplierPayable[]
}

type VoucherItem = {
  id: number
  payableId: number
  amountTWD: string
  payable: {
    receipt: { order: { id: number; poNo: string } | null } | null
    shipment: { shipmentNo: string } | null
    po: { poNo: string } | null
  }
}
type VoucherAdjustment = {
  id: number; name: string; amountTWD: string; category: string; note: string | null
}
type Voucher = {
  id: number; voucherNo: string; supplierId: number; status: string; vatPct: string; note: string | null
  createdAt: string; sentAt: string | null; confirmedAt: string | null; paidAt: string | null
  supplier: { id: number; name: string; shortName: string | null }
  items: VoucherItem[]
  adjustments: VoucherAdjustment[]
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿', SENT: '已傳送', CONFIRMED: '供應商確認', PAID: '已付款',
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', SENT: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-yellow-100 text-yellow-700', PAID: 'bg-green-100 text-green-700',
}
const ADJ_CATEGORY: Record<string, string> = {
  LOGISTICS: '物流費用', PASSTHROUGH: '代墊費用', FORMULA: 'FOB 分攤',
  COMMISSION: '佣金', TAX: '稅款', OTHER: '其他',
}

function fmt(n: string | number) {
  return Math.round(Number(n)).toLocaleString('zh-TW')
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VouchersPage() {
  const [shipments, setShipments] = useState<ShipmentGroup[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loadingShipments, setLoadingShipments] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [viewVoucher, setViewVoucher] = useState<Voucher | null>(null)
  const [saving, setSaving] = useState(false)

  const loadShipments = useCallback(async () => {
    setLoadingShipments(true)
    try {
      const res = await fetch('/api/finance/shipment-payables')
      if (res.ok) {
        const data = await res.json()
        setShipments(data.shipments ?? [])
      }
    } finally {
      setLoadingShipments(false)
    }
  }, [])

  const loadVouchers = useCallback(async () => {
    const res = await fetch('/api/finance/payment-vouchers')
    if (res.ok) setVouchers(await res.json())
  }, [])

  useEffect(() => {
    loadShipments()
    loadVouchers()
  }, [loadShipments, loadVouchers])

  function toggleExpand(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleVoucherCreated() {
    loadShipments()
    loadVouchers()
  }

  // ── Voucher status update ─────────────────────────────────────────────────
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
      if (status === 'PAID') loadShipments()
    }
  }

  async function deleteVoucher(id: number) {
    if (!confirm('確定要刪除這張付款通知單嗎？')) return
    await fetch(`/api/finance/payment-vouchers/${id}`, { method: 'DELETE' })
    setVouchers(prev => prev.filter(v => v.id !== id))
    if (viewVoucher?.id === id) setViewVoucher(null)
    loadShipments()
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-sm text-gray-400 hover:text-gray-600">← 財務</Link>
        <h1 className="text-xl font-semibold">付款通知單</h1>
      </div>

      {/* ── 待付出貨 ─────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">待付出貨</h2>
          <p className="text-xs text-gray-400">已出貨、尚未開立付款通知單的應付帳款</p>
        </div>

        {loadingShipments ? (
          <p className="text-sm text-gray-400">載入中...</p>
        ) : shipments.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-sm text-gray-400">
            目前沒有待付款的出貨記錄
          </div>
        ) : (
          <div className="space-y-3">
            {shipments.map(s => {
              const expanded = expandedIds.has(s.id)
              const totalPayable = s.payables.reduce((sum, p) => sum + p.amountTWD, 0)
              const supplierCount = new Set(s.payables.map(p => p.supplierId)).size

              return (
                <div key={s.id} className="bg-white rounded-lg shadow overflow-hidden">
                  {/* 出貨摘要列 */}
                  <button
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                    onClick={() => toggleExpand(s.id)}>
                    <span className="font-mono font-semibold text-gray-800">{s.shipmentNo}</span>
                    {s.actualShipDate && (
                      <span className="text-sm text-gray-500">
                        {new Date(s.actualShipDate).toLocaleDateString('zh-TW')}
                      </span>
                    )}
                    {s.customerName && (
                      <span className="text-sm text-gray-500">·  {s.customerName}</span>
                    )}
                    <span className="ml-auto flex items-center gap-4 text-sm">
                      <span className="text-gray-400">{supplierCount} 家供應商</span>
                      <span className="font-mono text-gray-700">NT$ {fmt(totalPayable)}</span>
                      {s.fobCostItems.length > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200">
                          FOB {s.fobCostItems.length} 筆費用
                        </span>
                      )}
                      <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
                    </span>
                  </button>

                  {/* 展開內容：FOB 費用管理 + 供應商付款表格 */}
                  {expanded && (
                    <div className="border-t border-gray-100">
                      <ShipmentPayablesPanel
                        shipmentId={s.id}
                        shipmentNo={s.shipmentNo}
                        actualShipDate={s.actualShipDate}
                        customerName={s.customerName}
                        initialCostItems={s.fobCostItems}
                        payables={s.payables}
                        onVoucherCreated={handleVoucherCreated}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── 付款通知單記錄 ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">付款通知單記錄</h2>
        {vouchers.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-sm text-gray-400">
            尚無付款通知單
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="text-left px-4 py-2">通知單號</th>
                  <th className="text-left px-4 py-2">供應商</th>
                  <th className="text-left px-4 py-2">狀態</th>
                  <th className="text-right px-4 py-2">付款金額 (TWD)</th>
                  <th className="text-right px-4 py-2">建立日</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map(v => {
                  const itemsTotal = v.items.reduce((s, i) => s + Number(i.amountTWD), 0)
                  const adjTotal = v.adjustments.reduce((s, a) => s + Number(a.amountTWD), 0)
                  const subtotal = itemsTotal + adjTotal
                  const final = subtotal + subtotal * Number(v.vatPct) / 100
                  return (
                    <tr key={v.id}
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => setViewVoucher(viewVoucher?.id === v.id ? null : v)}>
                      <td className="px-4 py-2.5 font-mono text-xs">{v.voucherNo}</td>
                      <td className="px-4 py-2.5 text-gray-700">{v.supplier.shortName ?? v.supplier.name}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[v.status]}`}>
                          {STATUS_LABEL[v.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium">NT$ {fmt(final)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400 text-xs">
                        {new Date(v.createdAt).toLocaleDateString('zh-TW')}
                      </td>
                      <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                        {v.status !== 'PAID' && (
                          <button onClick={() => deleteVoucher(v.id)}
                            className="text-xs text-gray-400 hover:text-red-500">刪除</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 付款通知單詳情 */}
        {viewVoucher && (
          <VoucherDetail
            voucher={viewVoucher}
            onStatusChange={s => updateStatus(viewVoucher.id, s)}
            saving={saving}
          />
        )}
      </section>
    </div>
  )
}

// ─── VoucherDetail ────────────────────────────────────────────────────────────

function VoucherDetail({ voucher, onStatusChange, saving }: {
  voucher: Voucher; onStatusChange: (s: string) => void; saving: boolean
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
    <div className="bg-white rounded-lg shadow p-5 mt-3 space-y-4">
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
            <th className="text-left pb-1 pr-4">採購單號 / 出貨單</th>
            <th className="text-right pb-1">金額 (TWD)</th>
          </tr>
        </thead>
        <tbody>
          {voucher.items.map(item => (
            <tr key={item.id} className="border-b border-gray-50">
              <td className="py-1.5 pr-4 font-mono text-xs text-gray-600">
                {item.payable.po?.poNo ?? item.payable.receipt?.order?.poNo ?? '—'}
                {item.payable.shipment && (
                  <span className="ml-2 text-gray-400">（{item.payable.shipment.shipmentNo}）</span>
                )}
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
              <span className="text-gray-600">
                {a.name}
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
        <div className="flex justify-between"><span className="text-gray-500">應付小計</span><span>{fmt(itemsTotal)}</span></div>
        {adjTotal !== 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">調整合計</span>
            <span className={adjTotal < 0 ? 'text-red-600' : ''}>{adjTotal > 0 ? '+' : ''}{fmt(adjTotal)}</span>
          </div>
        )}
        <div className="flex justify-between border-t pt-1"><span className="text-gray-500">小計</span><span>{fmt(subtotal)}</span></div>
        <div className="flex justify-between text-gray-400"><span>營業稅 {voucher.vatPct}%</span><span>{fmt(vatAmount)}</span></div>
        <div className="flex justify-between font-bold text-base border-t pt-1">
          <span>本次付款金額</span><span>NT$ {fmt(finalAmount)}</span>
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
            className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? '更新中...' : nextAction.label}
          </button>
          <button
            onClick={() => window.open(`/print/pv/${voucher.id}`, '_blank')}
            className="border border-gray-300 text-gray-700 px-5 py-2 rounded-md text-sm hover:bg-gray-50">
            🖨 列印付款通知單
          </button>
        </div>
      )}

      {voucher.note && <p className="text-sm text-gray-500">備註：{voucher.note}</p>}
    </div>
  )
}
