'use client'

import { useState } from 'react'
import { formatDate } from '@/lib/utils'

interface ShippingNoticeDetailProps {
  notice: {
    id: number
    noticeNo: string
    issueDate: Date
    status: string
    note: string | null
    supplier: {
      id: number
      name: string
      email: string | null
      contactPerson: string | null
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
}

export default function ShippingNoticeDetail({ notice }: ShippingNoticeDetailProps) {
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState(false)

  async function handleSendEmail() {
    if (!notice.supplier.email) {
      setEmailError('供應商未設定 Email 地址')
      return
    }

    setSendingEmail(true)
    setEmailError('')
    setEmailSuccess(false)

    try {
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
                <span className="text-gray-400 w-24">通知日期</span>
                <span className="text-gray-800">{formatDate(notice.issueDate)}</span>
              </div>
            </div>
          </div>

          {notice.status === 'DRAFT' && notice.supplier.email && (
            <button
              onClick={handleSendEmail}
              disabled={sendingEmail}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg whitespace-nowrap"
            >
              {sendingEmail ? '寄送中...' : '📧 Email 寄送'}
            </button>
          )}
        </div>

        {emailError && <p className="text-sm text-red-500 mt-2">{emailError}</p>}
        {emailSuccess && <p className="text-sm text-green-600 mt-2">✅ 郵件已寄送！</p>}

        {notice.note && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">備註</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{notice.note}</p>
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
    </div>
  )
}
