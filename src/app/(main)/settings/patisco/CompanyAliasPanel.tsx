'use client'
import { useState, useEffect, useCallback } from 'react'

type Alias = {
  id: number
  alias: string
  role: string
  customerId: number | null
  supplierId: number | null
  customer: { id: number; name: string } | null
  supplier: { id: number; name: string } | null
  createdAt: string
}

type PendingCompany = {
  name: string
  roleHint: string
  docType: string
  docNos: string[]
}

type CustomerOption = { id: number; name: string }
type SupplierOption = { id: number; name: string }

const ROLE_LABEL: Record<string, string> = {
  SELF:     '我公司',
  CUSTOMER: '買家（客戶）',
  SUPPLIER: '賣家（供應商）',
  OTHER:    '其他（忽略）',
}
const ROLE_COLOR: Record<string, string> = {
  SELF:     'bg-purple-100 text-purple-700',
  CUSTOMER: 'bg-blue-100 text-blue-700',
  SUPPLIER: 'bg-green-100 text-green-700',
  OTHER:    'bg-gray-100 text-gray-500',
}

export default function CompanyAliasPanel() {
  const [aliases, setAliases]   = useState<Alias[]>([])
  const [pending, setPending]   = useState<PendingCompany[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)

  // 確認 dialog state
  const [confirmItem, setConfirmItem] = useState<PendingCompany | null>(null)
  const [confirmRole, setConfirmRole] = useState('CUSTOMER')
  const [confirmCustId, setConfirmCustId] = useState('')
  const [confirmSuppId, setConfirmSuppId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [aliasRes, custRes, suppRes] = await Promise.all([
      fetch('/api/patisco/company-aliases').then(r => r.json()),
      fetch('/api/customers?limit=200').then(r => r.json()),
      fetch('/api/suppliers?limit=200').then(r => r.json()),
    ])
    setAliases(aliasRes.aliases ?? [])
    setPending(aliasRes.pending ?? [])
    setCustomers(Array.isArray(custRes) ? custRes : (custRes.items ?? []))
    setSuppliers(Array.isArray(suppRes) ? suppRes : (suppRes.items ?? []))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openConfirm(item: PendingCompany) {
    setConfirmItem(item)
    setConfirmRole(item.roleHint === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER')
    setConfirmCustId('')
    setConfirmSuppId('')
  }

  async function submitConfirm() {
    if (!confirmItem) return
    setSaving(true)
    await fetch('/api/patisco/company-aliases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alias:      confirmItem.name,
        role:       confirmRole,
        customerId: confirmRole === 'CUSTOMER' && confirmCustId ? Number(confirmCustId) : undefined,
        supplierId: confirmRole === 'SUPPLIER' && confirmSuppId ? Number(confirmSuppId) : undefined,
      }),
    })
    // 角色確認後立即重新同步，讓待匯文件馬上處理
    await fetch('/api/patisco/sync', { method: 'POST' })
    setSaving(false)
    setConfirmItem(null)
    load()
  }

  async function deleteAlias(alias: string) {
    if (!confirm(`確定刪除別名「${alias}」的角色設定嗎？`)) return
    await fetch(`/api/patisco/company-aliases?alias=${encodeURIComponent(alias)}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="mt-8 border-t border-gray-200 pt-6">
      <h2 className="text-base font-semibold text-gray-800 mb-1">公司別名與角色</h2>
      <p className="text-sm text-gray-500 mb-4">
        首次從 Patisco 匯入文件時，系統無法自動判別未知公司的角色（買家/賣家/我公司）。
        請在此確認角色後，系統將永久記錄，後續自動識別，不再詢問。
      </p>

      {/* 待確認區塊 */}
      {pending.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-amber-800 mb-3">
            ⚠ 以下公司名稱尚未確認角色（共 {pending.length} 筆），含有這些公司的文件暫停匯入，請逐一確認：
          </p>
          <div className="space-y-2">
            {pending.map((p, i) => (
              <div key={i} className="flex items-start gap-3 bg-white rounded border border-amber-100 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-800">{p.name}</span>
                  <span className="ml-2 text-xs text-gray-400">（出現在 {p.docType}）</span>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">
                    文件號：{p.docNos.slice(0, 3).join('、')}{p.docNos.length > 3 ? ` 等 ${p.docNos.length} 筆` : ''}
                  </div>
                </div>
                <button onClick={() => openConfirm(p)}
                  className="shrink-0 px-3 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700">
                  確認角色
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 已知別名清單 */}
      {loading ? (
        <p className="text-sm text-gray-400">載入中…</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">文件中的公司名稱</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">角色</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">關聯主檔</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {aliases.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400 text-xs">
                  尚無記錄。當 Patisco 文件中出現未知公司時，系統會自動列在上方待確認區塊。
                </td></tr>
              )}
              {aliases.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{a.alias}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLOR[a.role] ?? 'bg-gray-100'}`}>
                      {ROLE_LABEL[a.role] ?? a.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {a.customer?.name ?? a.supplier?.name ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => deleteAlias(a.alias)}
                      className="text-xs text-red-400 hover:text-red-600">刪除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 確認角色 dialog */}
      {confirmItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-base font-semibold mb-1">確認公司角色</h3>
            <p className="text-sm text-gray-500 mb-4">
              文件中出現的公司名稱：
              <span className="ml-1 font-mono font-medium text-gray-800">{confirmItem.name}</span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">這家公司是…</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'CUSTOMER', label: '買家（我們的客戶）' },
                    { value: 'SUPPLIER', label: '賣家（我們的供應商）' },
                    { value: 'SELF',     label: '我公司（另一個名稱）' },
                    { value: 'OTHER',    label: '其他（物流商等，忽略）' },
                  ].map(opt => (
                    <button key={opt.value}
                      type="button"
                      onClick={() => setConfirmRole(opt.value)}
                      className={`px-3 py-2 text-sm rounded border text-left transition-colors ${
                        confirmRole === opt.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {confirmRole === 'CUSTOMER' && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    關聯至客戶主檔
                    <span className="text-gray-400 font-normal ml-1">（選填，可稍後再關聯）</span>
                  </label>
                  <select value={confirmCustId} onChange={e => setConfirmCustId(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option value="">— 暫不關聯，角色確認後即可匯入 —</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    不選擇也可以確認，訂單將以公司名稱顯示，日後可至此頁補充關聯。
                  </p>
                </div>
              )}

              {confirmRole === 'SUPPLIER' && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    關聯至供應商主檔
                    <span className="text-gray-400 font-normal ml-1">（選填，可稍後再關聯）</span>
                  </label>
                  <select value={confirmSuppId} onChange={e => setConfirmSuppId(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option value="">— 暫不關聯，角色確認後即可繼續 —</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    供應商類文件需要關聯主檔才能建立採購單，建議盡快至此頁補充。
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirmItem(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
                取消
              </button>
              <button
                onClick={submitConfirm}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {saving ? '儲存中…' : '確認並重試匯入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
