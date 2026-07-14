'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { taipeiDateISO } from '@/lib/utils'

type Supplier = { id: number; name: string; shortName: string | null; email: string | null }
type POOption = {
  id: number
  poNo: string
  items: { id: number; product: { id: number; sku: string | null; name: string; unit: string | null } | null; quantity: number }[]
}
type ChargeTemplate = { id: number; name: string; description: string | null }
type PORemaining = {
  poId: number
  poNo: string
  totalOriginal: number
  totalNotified: number
  totalRemaining: number
}

type LineItem = {
  poId: number
  productId: number
  productName: string
  productSku: string | null
  poQuantity: number
  notifiedQuantity: number
  unit: string
}

export default function ShippingNoticeForm({
  suppliers,
  orgSlug,
}: {
  suppliers: Supplier[]
  orgSlug: string
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [supplierId, setSupplierId] = useState('')
  const [issueDate, setIssueDate] = useState(taipeiDateISO())
  const [note, setNote] = useState('')
  const [items, setItems] = useState<LineItem[]>([])

  const [poOptions, setPoOptions] = useState<POOption[]>([])
  const [poRemaining, setPoRemaining] = useState<Record<number, PORemaining>>({})
  const [chargeTemplates, setChargeTemplates] = useState<ChargeTemplate[]>([])
  const [loadingPos, setLoadingPos] = useState(false)

  // 選供應商後，拉該供應商的 PO 訂單、費用樣板、以及每張 PO 的剩餘量
  useEffect(() => {
    if (!supplierId) {
      setPoOptions([])
      setPoRemaining({})
      return
    }
    setLoadingPos(true)
    Promise.all([
      fetch(`/api/purchases?supplierId=${supplierId}&limit=50`).then(r => r.json()),
      fetch(`/api/charge-templates`).then(r => r.json()),
    ])
      .then(async ([purchaseData, templateData]) => {
        const pos = purchaseData.purchases ?? []
        setPoOptions(pos)
        setChargeTemplates(Array.isArray(templateData) ? templateData : templateData.templates ?? [])

        // 並行查詢每張 PO 的剩餘量
        const remainingMap: Record<number, PORemaining> = {}
        await Promise.all(
          pos.map(async (po: POOption) => {
            try {
              const res = await fetch(`/api/purchases/${po.id}/remaining`)
              if (res.ok) {
                const data = await res.json()
                remainingMap[po.id] = data
              }
            } catch (e) {
              console.error(`Failed to fetch remaining for PO ${po.id}`, e)
            }
          })
        )
        setPoRemaining(remainingMap)
      })
      .finally(() => setLoadingPos(false))
  }, [supplierId])

  function importFromPO(poId: string) {
    const poNum = Number(poId)
    const po = poOptions.find(p => p.id === poNum)
    if (!po) return

    const newItems: LineItem[] = po.items
      .filter(i => i.product)
      .map(i => ({
        poId: po.id,
        productId: i.product!.id,
        productName: i.product!.name,
        productSku: i.product!.sku,
        poQuantity: i.quantity,
        notifiedQuantity: i.quantity,
        unit: i.product!.unit ?? 'PCS',
      }))

    if (newItems.length > 0) {
      setItems(prev => [...prev, ...newItems])
    }
  }

  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateItem<K extends keyof LineItem>(i: number, key: K, val: LineItem[K]) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it))
  }

  // 已選過的 PO ID
  const selectedPoIds = new Set(items.map(it => it.poId))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/shipping-notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplierId ? Number(supplierId) : null,
          issueDate,
          note: note || null,
          items: items.filter(it => it.notifiedQuantity > 0).map(it => ({
            poId: it.poId,
            productId: it.productId,
            poQuantity: it.poQuantity,
            notifiedQuantity: it.notifiedQuantity,
            unit: it.unit,
          })),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? '儲存失敗')
      const { notice } = await res.json()
      router.push(`/${orgSlug}/purchases/shipping-notices/${notice.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗')
      setSaving(false)
    }
  }

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
  const ic = 'w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-white rounded-lg shadow p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">基本資訊</h2>
        <div className="grid grid-cols-2 gap-4">
          <F label="通知日期">
            <input type="date" className={ic} value={issueDate} onChange={e => setIssueDate(e.target.value)} required />
          </F>
          <F label="供應商">
            <select className={ic} value={supplierId} onChange={e => setSupplierId(e.target.value)} required>
              <option value="">-- 選擇供應商 --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.shortName ?? s.name}
                </option>
              ))}
            </select>
          </F>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <F label={`PO 訂單（${loadingPos ? '載入中...' : `${poOptions.length} 筆`}）`}>
            <select
              className={ic}
              onChange={e => importFromPO(e.target.value)}
              disabled={loadingPos || !supplierId}
            >
              <option value="">-- 選擇訂單並帶入品項 --</option>
              {poOptions.map(p => {
                const remaining = poRemaining[p.id]
                const isSelected = selectedPoIds.has(p.id)
                const displayText = remaining
                  ? `${p.poNo} (已通知 ${remaining.totalNotified}/${remaining.totalOriginal}，剩餘 ${remaining.totalRemaining})`
                  : p.poNo

                return (
                  <option key={p.id} value={p.id} disabled={isSelected}>
                    {displayText}
                  </option>
                )
              })}
            </select>
          </F>
          <F label="備註版模">
            <select
              className={ic}
              onChange={e => {
                const template = chargeTemplates.find(t => String(t.id) === e.target.value)
                if (template?.description) setNote(template.description)
              }}
            >
              <option value="">-- 選擇版模自動填入 --</option>
              {chargeTemplates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </F>
        </div>

        <F label="備註（可手動編輯）">
          <textarea className={`${ic} h-16 resize-none font-mono text-xs`} value={note} onChange={e => setNote(e.target.value)} />
        </F>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">出貨品項</h2>
          {items.length === 0 && (
            <p className="text-xs text-gray-400 mt-2">選擇 PO 訂單後，品項將自動帶入此處</p>
          )}
        </div>
        {items.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-28">訂單號</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-24">SKU</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">品名</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-16">PO 數量</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-20">通知數量 *</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-16">單位</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5 font-mono text-xs text-blue-600">{poOptions.find(p => p.id === item.poId)?.poNo || '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{item.productSku || '—'}</td>
                  <td className="px-3 py-1.5 text-gray-700 text-sm">{item.productName}</td>
                  <td className="px-3 py-1.5 text-right text-gray-500">{item.poQuantity}</td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min="0"
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right"
                      value={item.notifiedQuantity}
                      onChange={e => updateItem(i, 'notifiedQuantity', Number(e.target.value))}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-gray-500 text-sm">{item.unit}</td>
                  <td className="px-3 py-1.5 text-center">
                    <button type="button" onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving || items.length === 0} className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm px-6 py-2 rounded-lg">
          {saving ? '儲存中...' : '建立通知單'}
        </button>
        <a href={`/${orgSlug}/purchases/shipping-notices`} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
          取消
        </a>
      </div>
    </form>
  )
}
