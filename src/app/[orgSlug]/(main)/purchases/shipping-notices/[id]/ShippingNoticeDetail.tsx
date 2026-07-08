'use client'

import { useState, useEffect } from 'react'
import { formatDate } from '@/lib/utils'
import { useOrgPath } from '@/lib/use-org-path'

interface ShippingNoticeDetailProps {
  notice: {
    id: number
    noticeNo: string
    issueDate: Date
    status: string
    note: string | null
    deliverToName: string | null
    deliverToAddress: string | null
    deliverToContact: string | null
    sourceShipment: { id: number; shipmentNo: string } | null
    supplier: {
      id: number
      name: string
      email: string | null
      contactPerson: string | null
      phoneNo: string | null
      address: string | null
      city: string | null
      countryCode: string | null
    }
    items: Array<{
      id: number
      poQuantity: number
      notifiedQuantity: number
      unit: string | null
      po: { id: number; poNo: string }
      product: { id: number; sku: string | null; name: string; unit: string | null }
    }>
    performer: { id: number; name: string } | null
  }
  deliverPresets: {
    office: { name: string; address: string; contact: string } | null
    containerYard: string | null
    suppliers: Array<{ id: number; label: string; name: string; address: string; contact: string }>
  }
}

interface PONotificationHistory {
  noticeNo: string
  issueDate: string
  status: string
  items: Array<{
    productSku: string | null
    productName: string
    notifiedQuantity: number
  }>
}

export default function ShippingNoticeDetail({ notice, deliverPresets }: ShippingNoticeDetailProps) {
  const orgPath = useOrgPath()
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState(false)
  const [poHistory, setPoHistory] = useState<Record<number, PONotificationHistory[]>>({})
  const [reverting, setReverting] = useState(false)
  const [revertError, setRevertError] = useState('')

  // 交貨地點編輯
  const [deliverToName, setDeliverToName] = useState(notice.deliverToName ?? '')
  const [deliverToAddress, setDeliverToAddress] = useState(notice.deliverToAddress ?? '')
  const [deliverToContact, setDeliverToContact] = useState(notice.deliverToContact ?? '')
  const [savingDeliver, setSavingDeliver] = useState(false)
  const [deliverSaved, setDeliverSaved] = useState(false)
  const [deliverMode, setDeliverMode] = useState<'office' | 'supplier' | 'yard' | 'other' | null>(null)

  function applyPreset(mode: 'office' | 'supplier' | 'yard' | 'other', supplierId?: number) {
    setDeliverMode(mode)
    if (mode === 'office' && deliverPresets.office) {
      setDeliverToName(deliverPresets.office.name)
      setDeliverToAddress(deliverPresets.office.address)
      setDeliverToContact(deliverPresets.office.contact)
    } else if (mode === 'yard' && deliverPresets.containerYard) {
      setDeliverToName(deliverPresets.containerYard)
      setDeliverToAddress('')
      setDeliverToContact('')
    } else if (mode === 'supplier' && supplierId != null) {
      const s = deliverPresets.suppliers.find(x => x.id === supplierId)
      if (s) {
        setDeliverToName(s.name)
        setDeliverToAddress(s.address)
        setDeliverToContact(s.contact)
      }
    } else if (mode === 'other') {
      setDeliverToName('')
      setDeliverToAddress('')
      setDeliverToContact('')
    }
  }

  async function saveDeliverTo() {
    setSavingDeliver(true)
    setDeliverSaved(false)
    try {
      const res = await fetch(`/api/shipping-notices/${notice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliverToName, deliverToAddress, deliverToContact }),
      })
      if (res.ok) {
        setDeliverSaved(true)
        setTimeout(() => setDeliverSaved(false), 2000)
      }
    } finally {
      setSavingDeliver(false)
    }
  }

  // 載入每張 PO 的通知歷史
  useEffect(() => {
    const uniquePoIds = Array.from(new Set(notice.items.map(it => it.po.id)))
    const histories: Record<number, PONotificationHistory[]> = {}

    Promise.all(
      uniquePoIds.map(async poId => {
        try {
          const res = await fetch(`/api/shipping-notices/po/${poId}/history`)
          if (res.ok) {
            const data = await res.json()
            histories[poId] = data.history || []
          }
        } catch (e) {
          console.error(`Failed to fetch history for PO ${poId}`, e)
        }
      })
    ).then(() => setPoHistory(histories))
  }, [notice.items])

  async function handleSendEmail() {
    if (!notice.supplier.email) {
      setEmailError('供應商未設定 Email 地址')
      return
    }

    setSendingEmail(true)
    setEmailError('')
    setEmailSuccess(false)

    try {
      // 寄出前先存交貨地點，確保 Email 帶到最新內容
      await fetch(`/api/shipping-notices/${notice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliverToName, deliverToAddress, deliverToContact }),
      })
      const res = await fetch(`/api/shipping-notices/${notice.id}/send-email`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error((await res.json()).error ?? '寄送失敗')
      setEmailSuccess(true)
      // 可選：重新載入頁面以更新狀態
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : '寄送失敗')
    } finally {
      setSendingEmail(false)
    }
  }

  async function handleRevert() {
    if (!confirm(`確定要退回通知單 ${notice.noticeNo} 嗎？\n已通知的數量將全部還原。`)) return

    setReverting(true)
    setRevertError('')

    try {
      const res = await fetch(`/api/shipping-notices/${notice.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error((await res.json()).error ?? '退回失敗')
      // 返回清單
      window.location.href = window.location.pathname.split('/').slice(0, -1).join('/')
    } catch (err) {
      setRevertError(err instanceof Error ? err.message : '退回失敗')
      setReverting(false)
    }
  }

  const totalNotified = notice.items.reduce((sum, item) => sum + item.notifiedQuantity, 0)

  return (
    <div className="space-y-5">
      {/* 基本資訊 */}
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">通知資訊</h2>
            <div className="space-y-2 text-sm">
              <div className="flex gap-4">
                <span className="text-gray-400 w-24">供應商</span>
                <span className="text-gray-800 font-medium">{notice.supplier.name}</span>
              </div>
              <div className="flex gap-4">
                <span className="text-gray-400 w-24">聯絡人</span>
                <span className="text-gray-800">{notice.supplier.contactPerson || '—'}</span>
              </div>
              <div className="flex gap-4">
                <span className="text-gray-400 w-24">Email</span>
                <span className="text-gray-800 font-mono text-xs">{notice.supplier.email || '未設定'}</span>
              </div>
              <div className="flex gap-4">
                <span className="text-gray-400 w-24">電話</span>
                <span className="text-gray-800">{notice.supplier.phoneNo || '—'}</span>
              </div>
              <div className="flex gap-4">
                <span className="text-gray-400 w-24">地址</span>
                <span className="text-gray-800">
                  {[notice.supplier.address, notice.supplier.city, notice.supplier.countryCode].filter(Boolean).join(', ') || '—'}
                </span>
              </div>
              <div className="flex gap-4">
                <span className="text-gray-400 w-24">通知日期</span>
                <span className="text-gray-800">{formatDate(notice.issueDate)}</span>
              </div>
              {notice.sourceShipment && (
                <div className="flex gap-4">
                  <span className="text-gray-400 w-24">來源出貨單</span>
                  <a href={orgPath(`/shipments/${notice.sourceShipment.id}`)} className="text-teal-600 hover:underline font-mono text-xs">
                    {notice.sourceShipment.shipmentNo}
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <a
              href={`/print/sn/${notice.id}`}
              target="_blank"
              className="border border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 text-sm px-4 py-2 rounded-lg whitespace-nowrap"
            >
              🖨 A4 列印
            </a>
            {notice.status === 'DRAFT' && notice.supplier.email && (
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg whitespace-nowrap"
              >
                {sendingEmail ? '寄送中...' : '📧 Email 寄送'}
              </button>
            )}
            <button
              onClick={handleRevert}
              disabled={reverting}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg whitespace-nowrap"
            >
              {reverting ? '退回中...' : '🔄 退回'}
            </button>
          </div>
        </div>

        {emailError && <p className="text-sm text-red-500 mt-2">{emailError}</p>}
        {emailSuccess && <p className="text-sm text-green-600 mt-2">✅ 郵件已寄送！</p>}
        {revertError && <p className="text-sm text-red-500 mt-2">{revertError}</p>}

        {notice.note && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">備註</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{notice.note}</p>
          </div>
        )}
      </div>

      {/* 交貨地點 */}
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">交貨地點（供應商要出貨到哪裡）</h2>
          {notice.status === 'DRAFT' && (
            <div className="flex items-center gap-2">
              {deliverSaved && <span className="text-xs text-green-600">✓ 已儲存</span>}
              <button
                onClick={saveDeliverTo}
                disabled={savingDeliver}
                className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50">
                {savingDeliver ? '儲存中...' : '儲存'}
              </button>
            </div>
          )}
        </div>
        {notice.status === 'DRAFT' ? (
          <div className="grid grid-cols-1 gap-3">
            {/* 快速代入 */}
            <div className="flex items-center gap-2 flex-wrap">
              {deliverPresets.office && (
                <button
                  onClick={() => applyPreset('office')}
                  className={`text-xs px-3 py-1.5 rounded border ${deliverMode === 'office' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}>
                  🏢 我方辦公室
                </button>
              )}
              {deliverPresets.suppliers.length > 0 && (
                <select
                  value={deliverMode === 'supplier' ? '' : ''}
                  onChange={e => { if (e.target.value) applyPreset('supplier', Number(e.target.value)) }}
                  className={`text-xs px-2 py-1.5 rounded border ${deliverMode === 'supplier' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600'}`}>
                  <option value="">🏭 集貨供應商...</option>
                  {deliverPresets.suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              )}
              {deliverPresets.containerYard && (
                <button
                  onClick={() => applyPreset('yard')}
                  className={`text-xs px-3 py-1.5 rounded border ${deliverMode === 'yard' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}>
                  🚢 貨櫃場（{deliverPresets.containerYard}）
                </button>
              )}
              <button
                onClick={() => applyPreset('other')}
                className={`text-xs px-3 py-1.5 rounded border ${deliverMode === 'other' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}>
                ✏️ 其他（手動填寫）
              </button>
            </div>
            <label className="text-sm">
              <span className="text-gray-400 text-xs block mb-1">收貨方名稱（集貨供應商 / 貨櫃廠 / 我方辦公室）</span>
              <input value={deliverToName} onChange={e => setDeliverToName(e.target.value)}
                placeholder="例：○○貨櫃場、△△供應商倉庫"
                className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </label>
            <label className="text-sm">
              <span className="text-gray-400 text-xs block mb-1">收貨地址</span>
              <input value={deliverToAddress} onChange={e => setDeliverToAddress(e.target.value)}
                placeholder="完整地址"
                className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </label>
            <label className="text-sm">
              <span className="text-gray-400 text-xs block mb-1">收貨聯絡人 / 電話</span>
              <input value={deliverToContact} onChange={e => setDeliverToContact(e.target.value)}
                placeholder="例：王先生 0912-345-678"
                className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </label>
            {!deliverToName && !deliverToAddress && (
              <p className="text-xs text-amber-600">⚠ 尚未填寫交貨地點，寄出前建議先填寫，供應商才知道貨要出到哪裡</p>
            )}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex gap-4">
              <span className="text-gray-400 w-24">收貨方</span>
              <span className="text-gray-800">{notice.deliverToName || '—'}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-gray-400 w-24">地址</span>
              <span className="text-gray-800">{notice.deliverToAddress || '—'}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-gray-400 w-24">聯絡人</span>
              <span className="text-gray-800">{notice.deliverToContact || '—'}</span>
            </div>
          </div>
        )}
      </div>

      {/* 品項清單 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">出貨品項清單</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">訂單號</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">SKU</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">品名</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 w-20">PO 數量</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 w-20">通知數量</th>
              <th className="text-center px-4 py-2 text-xs font-medium text-gray-500 w-16">單位</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {notice.items.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs text-blue-600">{item.po.poNo}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">{item.product.sku || '—'}</td>
                <td className="px-4 py-2 text-gray-700">{item.product.name}</td>
                <td className="px-4 py-2 text-right text-gray-500">{item.poQuantity}</td>
                <td className="px-4 py-2 text-right font-medium text-gray-800">{item.notifiedQuantity}</td>
                <td className="px-4 py-2 text-center text-gray-500">{item.unit || item.product.unit || 'PCS'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 border-gray-300">
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-xs font-semibold text-gray-600">
                合計通知數量：
              </td>
              <td className="px-4 py-2 text-right text-sm font-bold text-gray-800">{totalNotified}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 通知歷史 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">訂單出貨通知歷史</h2>
          <p className="text-xs text-gray-400 mt-1">顯示該訂單在所有通知單中的通知記錄（分次通知追蹤）</p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {Object.entries(poHistory).length === 0 ? (
            <p className="text-xs text-gray-400">載入中或無通知歷史...</p>
          ) : (
            Object.entries(poHistory).map(([poId, notifications]) => (
              <div key={poId} className="border border-gray-200 rounded p-4">
                <p className="text-sm font-medium text-gray-800 mb-3">
                  訂單 {notice.items.find(it => String(it.po.id) === poId)?.po.poNo}
                </p>
                {notifications.length === 0 ? (
                  <p className="text-xs text-gray-400">此訂單尚無通知記錄</p>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((notif: any, idx: number) => (
                      <div key={idx} className="bg-gray-50 rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono text-blue-600">{notif.noticeNo}</span>
                          <span className="text-xs text-gray-500">{notif.issueDate}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${notif.status === 'SENT' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                            {notif.status === 'SENT' ? '已寄送' : '已確認'}
                          </span>
                        </div>
                        <div className="text-xs space-y-1">
                          {notif.items.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between text-gray-600">
                              <span>{item.productSku ? `${item.productSku} - ` : ''}{item.productName}</span>
                              <span className="font-medium">通知 {item.notifiedQuantity} 件</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
