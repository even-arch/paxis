'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Supplier = { id: number; name: string; shortName: string | null; email: string | null }
type POOption = {
  id: number
  poNo: string
  items: { id: number; product: { id: number; sku: string | null; name: string; unit: string | null } | null; quantity: number }[]
}

type LineItem = {
  poId: number | null
  productId: number | null
  productName: string
  productSku: string | null
  poQuantity: number
  notifiedQuantity: number
  unit: string
  unitPrice: number | null
}

export default function ShippingNoticeForm({
  suppliers,
}: {
  suppliers: Supplier[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [supplierId, setSupplierId] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [items, setItems] = useState<LineItem[]>([
    { poId: null, productId: null, productName: '', productSku: null, poQuantity: 0, notifiedQuantity: 0, unit: 'PCS', unitPrice: null },
  ])

  const [poOptions, setPoOptions] = useState<POOption[]>([])
  const [loadingPos, setLoadingPos] = useState(false)

  // 選供應商後，拉該供應商的 PO 訂單
  useEffect(() => {
    if (!supplierId) {
      setPoOptions([])
      return
    }
    setLoadingPos(true)
    fetch(`/api/purchases?supplierId=${supplierId}&limit=50`)
      .then(r => r.json())
      .then(data => {
        setPoOptions(data.purchases ?? [])
      })
      .finally(() => setLoadingPos(false))
  }, [supplierId])

  function importFromPO(poId: string) {
    const po = poOptions.find(p => String(p.id) === poId)
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
        unitPrice: null,
      }))

    if (newItems.length > 0) setItems(newItems)
  }

  function addItem() {
    setItems(prev => [...prev, { poId: null, productId: null, productName: '', productSku: null, poQuantity: 0, notifiedQuantity: 0, unit: 'PCS', unitPrice: null }])
  }
  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateItem<K extends keyof LineItem>(i: number, key: K, val: LineItem[K]) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it))
  }

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
          items: items.filter(it => it.poId && it.productId && it.notifiedQuantity > 0).map(it => ({
            poId: it.poId,
            productId: it.productId,
            poQuantity: it.poQuantity,
            notifiedQuantity: it.notifiedQuantity,
            unit: it.unit,
            unitPrice: it.unitPrice,
          })),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? '儲存失敗')
      const { notice } = await res.json()
      router.push(`/purchases/shipping-notices/${notice.id}`)
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

        {supplierId && (
          <F label={`選擇 PO 訂單（${loadingPos ? '載入中...' : `${poOptions.length} 筆`}）`}>
            <select className={ic} onChange={e => importFromPO(e.target.value)} disabled={loadingPos}>
              <option value="">-- 選擇訂單自動帶入品項 --</option>
              {poOptions.map(p => (
                <option key={p.id} value={p.id}>
                  {p.poNo}
                </option>
              ))}
            </select>
          </F>
        )}

        <F label="備註">
          <textarea className={`${ic} h-16 resize-none font-mono text-xs`} value={note} onChange={e => setNote(e.target.value)} />
        </F>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">出貨品項</h2>
          <button type="button" onClick={addItem} className="text-xs text-teal-600 hover:text-teal-800">
            + 新增品項
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-32">訂單號</th>
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
                <td className="px-3 py-1.5">
                  <select
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
                    value={item.poId ?? ''}
                    onChange={e => {
                      const poId = Number(e.target.value)
                      const po = poOptions.find(p => p.id === poId)
                      if (po) {
                        updateItem(i, 'poId', poId)
                        // 帶入第一個品項的資訊作為預設
                        if (po.items[0]?.product) {
                          updateItem(i, 'productId', po.items[0].product.id)
                          updateItem(i, 'productName', po.items[0].product.name)
                          updateItem(i, 'productSku', po.items[0].product.sku)
                          updateItem(i, 'poQuantity', po.items[0].quantity)
                          updateItem(i, 'notifiedQuantity', po.items[0].quantity)
                          updateItem(i, 'unit', po.items[0].product.unit ?? 'PCS')
                        }
                      }
                    }}
                  >
                    <option value="">-- 選擇 PO --</option>
                    {poOptions.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.poNo}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input type="text" className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-gray-50" value={item.productSku ?? ''} readOnly />
                </td>
                <td className="px-3 py-1.5">
                  <input type="text" className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-gray-50" value={item.productName} readOnly />
                </td>
                <td className="px-3 py-1.5">
                  <input type="number" min="0" className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right bg-gray-50" value={item.poQuantity} readOnly />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right"
                    value={item.notifiedQuantity}
                    onChange={e => updateItem(i, 'notifiedQuantity', Number(e.target.value))}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input type="text" className="w-full border border-gray-200 rounded px-2 py-1 text-xs" value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)} />
                </td>
                <td className="px-3 py-1.5 text-center">{items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm px-6 py-2 rounded-lg">
          {saving ? '儲存中...' : '建立通知單'}
        </button>
        <a href="/purchases/shipping-notices" className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
          取消
        </a>
      </div>
    </form>
  )
}
