'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Customer = { id: number; name: string; shortName: string | null; contactPerson: string | null; phoneNo: string | null; address: string | null; city: string | null; shippingMarkTemplate: string | null }
type Product  = { id: number; sku: string | null; name: string; unit: string | null }
type PiOption = { id: number; piNo: string; items: { product: { id: number; sku: string | null; name: string; unit: string | null } | null; quantity: number }[] }
type OrderOption = { id: number; orderNo: string; items: { product: { id: number; sku: string | null; name: string; unit: string | null } | null; quantity: number }[] }

type LineItem = {
  productId: number | null
  description: string
  quantity: number
  unit: string
  cartons: number | null
  grossWeightKg: number | null
}

export default function DeliveryNoteForm({
  nextDocNo, customers, products,
}: {
  nextDocNo: string
  customers: Customer[]
  products: Product[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [docNo, setDocNo] = useState(nextDocNo)
  const [customerId, setCustomerId] = useState('')
  const [slsPiId, setSlsPiId] = useState('')
  const [slsOrderId, setSlsOrderId] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [deliveryDate, setDeliveryDate] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [deliveryAddr, setDeliveryAddr] = useState('')
  const [freightCo, setFreightCo] = useState('')
  const [vehicleNo, setVehicleNo] = useState('')
  const [shippingMark, setShippingMark] = useState('')
  const [note, setNote] = useState('')
  const [counterpartNo, setCounterpartNo] = useState('')
  const [items, setItems] = useState<LineItem[]>([
    { productId: null, description: '', quantity: 0, unit: 'PCS', cartons: null, grossWeightKg: null },
  ])

  const [piOptions, setPiOptions] = useState<PiOption[]>([])
  const [orderOptions, setOrderOptions] = useState<OrderOption[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)

  // 選客戶後，拉該客戶未出貨的 PI 和訂單
  useEffect(() => {
    if (!customerId) { setPiOptions([]); setOrderOptions([]); return }
    setLoadingDocs(true)
    fetch(`/api/delivery-notes/customer-docs?customerId=${customerId}`)
      .then(r => r.json())
      .then(data => { setPiOptions(data.pis ?? []); setOrderOptions(data.orders ?? []) })
      .finally(() => setLoadingDocs(false))
  }, [customerId])

  function applyOrderNoToMark(orderNo: string) {
    setShippingMark(prev => prev.replace(/\{orderNo\}/g, orderNo))
  }

  function importFromPi(piId: string) {
    setSlsPiId(piId)
    setSlsOrderId('')
    const pi = piOptions.find(p => String(p.id) === piId)
    if (!pi) return
    applyOrderNoToMark(pi.piNo)
    const newItems: LineItem[] = pi.items
      .filter(i => i.product)
      .map(i => ({
        productId: i.product!.id,
        description: i.product!.name,
        quantity: i.quantity,
        unit: i.product!.unit ?? 'PCS',
        cartons: null, grossWeightKg: null,
      }))
    if (newItems.length > 0) setItems(newItems)
  }

  function importFromOrder(orderId: string) {
    setSlsOrderId(orderId)
    setSlsPiId('')
    const ord = orderOptions.find(o => String(o.id) === orderId)
    if (!ord) return
    applyOrderNoToMark(ord.orderNo)
    const newItems: LineItem[] = ord.items
      .filter(i => i.product)
      .map(i => ({
        productId: i.product!.id,
        description: i.product!.name,
        quantity: i.quantity,
        unit: i.product!.unit ?? 'PCS',
        cartons: null, grossWeightKg: null,
      }))
    if (newItems.length > 0) setItems(newItems)
  }

  function addItem() {
    setItems(prev => [...prev, { productId: null, description: '', quantity: 0, unit: 'PCS', cartons: null, grossWeightKg: null }])
  }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)) }
  function updateItem<K extends keyof LineItem>(i: number, key: K, val: LineItem[K]) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it))
  }
  function selectProduct(i: number, productId: string) {
    const p = products.find(p => String(p.id) === productId)
    if (!p) return
    updateItem(i, 'productId', p.id)
    updateItem(i, 'description', p.name)
    updateItem(i, 'unit', p.unit ?? 'PCS')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/delivery-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docNo, customerId: customerId ? Number(customerId) : null,
          slsPiId: slsPiId ? Number(slsPiId) : null,
          slsOrderId: slsOrderId ? Number(slsOrderId) : null,
          issueDate, deliveryDate: deliveryDate || null,
          contactName, contactPhone, deliveryAddr, freightCo, vehicleNo,
          shippingMark, note, counterpartNo, items,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? '儲存失敗')
      const { id } = await res.json()
      router.push(`/delivery-notes/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗')
      setSaving(false)
    }
  }

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label className="block text-xs text-gray-500 mb-1">{label}</label>{children}</div>
  )
  const ic = "w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-white rounded-lg shadow p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">基本資訊</h2>
        <div className="grid grid-cols-3 gap-4">
          <F label="單號"><input className={ic} value={docNo} onChange={e => setDocNo(e.target.value)} required /></F>
          <F label="出貨日期"><input type="date" className={ic} value={issueDate} onChange={e => setIssueDate(e.target.value)} required /></F>
          <F label="預計送達"><input type="date" className={ic} value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} /></F>
        </div>

        {/* Step 1: 選客戶 */}
        <F label="客戶">
          <select className={ic} value={customerId} onChange={e => {
            const cid = e.target.value
            setCustomerId(cid); setSlsPiId(''); setSlsOrderId('')
            const c = customers.find(c => String(c.id) === cid)
            if (c) {
              if (!contactName  && c.contactPerson) setContactName(c.contactPerson)
              if (!contactPhone && c.phoneNo)       setContactPhone(c.phoneNo)
              if (!deliveryAddr && (c.address || c.city))
                setDeliveryAddr([c.address, c.city].filter(Boolean).join(' '))
              if (c.shippingMarkTemplate)
                setShippingMark(c.shippingMarkTemplate)
            }
          }} required>
            <option value="">-- 選擇客戶 --</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.shortName ?? c.name}</option>)}
          </select>
        </F>

        {/* Step 2: 選 PI 或訂單 */}
        {customerId && (
          <div className="grid grid-cols-2 gap-4">
            <F label={`帶入 PI（${loadingDocs ? '載入中...' : `${piOptions.length} 筆`}）`}>
              <select className={ic} value={slsPiId} onChange={e => importFromPi(e.target.value)} disabled={loadingDocs}>
                <option value="">-- 選擇 PI（自動帶入品項）--</option>
                {piOptions.map(p => <option key={p.id} value={p.id}>{p.piNo}</option>)}
              </select>
            </F>
            <F label={`或帶入客戶訂單（${loadingDocs ? '載入中...' : `${orderOptions.length} 筆`}）`}>
              <select className={ic} value={slsOrderId} onChange={e => importFromOrder(e.target.value)} disabled={loadingDocs}>
                <option value="">-- 選擇訂單（自動帶入品項）--</option>
                {orderOptions.map(o => <option key={o.id} value={o.id}>{o.orderNo}</option>)}
              </select>
            </F>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <F label="聯絡人"><input className={ic} value={contactName} onChange={e => setContactName(e.target.value)} /></F>
          <F label="聯絡電話"><input className={ic} value={contactPhone} onChange={e => setContactPhone(e.target.value)} /></F>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <F label="對方單號（客戶 PO）"><input className={ic} value={counterpartNo} onChange={e => setCounterpartNo(e.target.value)} /></F>
          <F label="貨運行"><input className={ic} value={freightCo} onChange={e => setFreightCo(e.target.value)} /></F>
          <F label="車號"><input className={ic} value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} /></F>
        </div>
        <F label="送貨地址"><input className={ic} value={deliveryAddr} onChange={e => setDeliveryAddr(e.target.value)} /></F>
        <F label="麥頭／備註">
          <textarea className={`${ic} h-16 resize-none font-mono text-xs`} value={shippingMark} onChange={e => setShippingMark(e.target.value)} />
        </F>
        <F label="內部備註"><input className={ic} value={note} onChange={e => setNote(e.target.value)} /></F>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">品項明細</h2>
          <button type="button" onClick={addItem} className="text-xs text-teal-600 hover:text-teal-800">+ 新增品項</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">商品</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">品名描述</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-20">數量</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-16">單位</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-16">箱數</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-20">毛重(kg)</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, i) => (
              <tr key={i}>
                <td className="px-3 py-1.5">
                  <select className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none" value={item.productId ?? ''} onChange={e => selectProduct(i, e.target.value)}>
                    <option value="">-- SKU --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.sku} {p.name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-1.5"><input className="w-full border border-gray-200 rounded px-2 py-1 text-xs" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} /></td>
                <td className="px-3 py-1.5"><input type="number" min="0" className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right" value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} /></td>
                <td className="px-3 py-1.5"><input className="w-full border border-gray-200 rounded px-2 py-1 text-xs" value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)} /></td>
                <td className="px-3 py-1.5"><input type="number" min="0" className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right" value={item.cartons ?? ''} onChange={e => updateItem(i, 'cartons', e.target.value ? Number(e.target.value) : null)} /></td>
                <td className="px-3 py-1.5"><input type="number" min="0" step="0.1" className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right" value={item.grossWeightKg ?? ''} onChange={e => updateItem(i, 'grossWeightKg', e.target.value ? Number(e.target.value) : null)} /></td>
                <td className="px-3 py-1.5 text-center">{items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm px-6 py-2 rounded-lg">
          {saving ? '儲存中...' : '儲存出貨單'}
        </button>
        <a href="/delivery-notes" className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">取消</a>
      </div>
    </form>
  )
}
