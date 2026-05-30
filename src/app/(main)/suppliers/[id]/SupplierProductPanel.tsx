'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type SupplierProduct = {
  id: number
  productId: number
  supplierSku: string | null
  unitPrice: { toString(): string } | string | null
  currencyCode: string | null
  moq: number | null
  leadTimeDays: number | null
  isPreferred: boolean
  product: { id: number; name: string; sku: string | null; unit: string | null }
}

type SimpleProduct = { id: number; name: string; sku: string | null }

type Props = {
  supplierId: string
  supplierProducts: SupplierProduct[]
  allProducts: SimpleProduct[]
}

const CURRENCIES = ['USD', 'CNY', 'TWD', 'EUR']

export default function SupplierProductPanel({ supplierId, supplierProducts, allProducts }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    productId: '', supplierSku: '', unitPrice: '',
    currencyCode: 'USD', moq: '', leadTimeDays: '', isPreferred: false,
  })

  const existingIds = new Set(supplierProducts.map(sp => sp.productId))
  const availableProducts = allProducts.filter(p => !existingIds.has(p.id))

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.productId) return
    setSaving(true)
    await fetch(`/api/suppliers/${supplierId}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setShowForm(false)
    setForm({ productId: '', supplierSku: '', unitPrice: '', currencyCode: 'USD', moq: '', leadTimeDays: '', isPreferred: false })
    router.refresh()
  }

  async function handleRemove(productId: number) {
    if (!confirm('確定移除此商品對應？')) return
    await fetch(`/api/suppliers/${supplierId}/products?productId=${productId}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-gray-700">供應商商品對應</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Patisco 訂單確認後，系統會依此對應建議採購來源
          </p>
        </div>
        {availableProducts.length > 0 && (
          <button onClick={() => setShowForm(!showForm)}
            className="text-sm text-blue-600 hover:underline">
            {showForm ? '取消' : '+ 新增對應'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-gray-50 rounded-md p-4 mb-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div className="md:col-span-3">
            <label className="block text-xs text-gray-500 mb-1">商品 *</label>
            <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
              className={inp} required>
              <option value="">請選擇商品</option>
              {availableProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">供應商料號</label>
            <input type="text" value={form.supplierSku} onChange={e => setForm(f => ({ ...f, supplierSku: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">單價</label>
            <input type="number" step="0.0001" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">幣別</label>
            <select value={form.currencyCode} onChange={e => setForm(f => ({ ...f, currencyCode: e.target.value }))} className={inp}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">MOQ（最小起訂量）</label>
            <input type="number" value={form.moq} onChange={e => setForm(f => ({ ...f, moq: e.target.value }))} className={inp} min="1" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">交期（天）</label>
            <input type="number" value={form.leadTimeDays} onChange={e => setForm(f => ({ ...f, leadTimeDays: e.target.value }))} className={inp} min="0" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isPreferred}
                onChange={e => setForm(f => ({ ...f, isPreferred: e.target.checked }))}
                className="rounded" />
              <span className="text-xs text-gray-600">設為主要供應商</span>
            </label>
          </div>
          <div className="md:col-span-3 flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? '新增中...' : '確認新增'}
            </button>
          </div>
        </form>
      )}

      {supplierProducts.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">尚未對應任何商品</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="py-2">商品</th>
              <th className="py-2">供應商料號</th>
              <th className="py-2">單價</th>
              <th className="py-2">MOQ</th>
              <th className="py-2">交期</th>
              <th className="py-2">主要</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {supplierProducts.map((sp: SupplierProduct) => (
              <tr key={sp.id} className={sp.isPreferred ? 'bg-blue-50' : ''}>
                <td className="py-2">
                  <Link href={`/products/${sp.product.id}`} className="text-blue-600 hover:underline">
                    {sp.product.name}
                  </Link>
                  {sp.product.sku && <span className="text-gray-400 text-xs ml-1">({sp.product.sku})</span>}
                </td>
                <td className="py-2 text-gray-500">{sp.supplierSku ?? '-'}</td>
                <td className="py-2">{sp.unitPrice ? `${sp.currencyCode} ${sp.unitPrice}` : '-'}</td>
                <td className="py-2 text-gray-500">{sp.moq ?? '-'}</td>
                <td className="py-2 text-gray-500">{sp.leadTimeDays ? `${sp.leadTimeDays} 天` : '-'}</td>
                <td className="py-2">
                  {sp.isPreferred && <span className="text-blue-600 text-xs font-medium">✓ 主要</span>}
                </td>
                <td className="py-2 text-right">
                  <button onClick={() => handleRemove(sp.productId)}
                    className="text-red-400 hover:text-red-600 text-xs">移除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const inp = 'w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'

function Link({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return <a href={href} className={className}>{children}</a>
}
