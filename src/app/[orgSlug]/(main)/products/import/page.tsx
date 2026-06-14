'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { ParsedInvoice } from '@/app/api/ai/parse-invoice/route'
import type { PreviewItem } from '@/app/api/products/import-preview/route'

type Action = 'create' | 'update' | 'keep' | 'skip'

interface DecisionItem extends PreviewItem {
  action: Action
}

interface ImportResult {
  name: string; sku: string | null; action: string; productId?: number; reason?: string
}

export default function ProductImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [parsing, setParsing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null)
  const [decisions, setDecisions] = useState<DecisionItem[]>([])
  const [results, setResults] = useState<ImportResult[]>([])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setParsing(true)
    setMsg({ type: 'info', text: `AI 解析中：${file.name}…` })

    try {
      const fd = new FormData()
      fd.append('file', file)
      const parseRes = await fetch('/api/ai/parse-invoice', { method: 'POST', body: fd })
      const parseData = await parseRes.json() as { data?: ParsedInvoice; error?: string }
      if (!parseRes.ok) throw new Error(parseData.error ?? '解析失敗')

      // 衝突預檢
      const previewRes = await fetch('/api/products/import-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: parseData.data!.items }),
      })
      const previewData = await previewRes.json() as { items: PreviewItem[] }

      const initialized: DecisionItem[] = previewData.items.map(p => ({
        ...p,
        action: p.conflict ? 'keep' : 'create',
      }))

      setDecisions(initialized)
      setStep('preview')

      const conflicts = initialized.filter(d => d.conflict).length
      const news = initialized.filter(d => !d.conflict).length
      setMsg({
        type: 'ok',
        text: `解析完成：${news} 項新產品，${conflicts} 項 SKU/品名衝突需確認。`,
      })
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setParsing(false)
    }
  }

  function setAction(index: number, action: Action) {
    setDecisions(prev => prev.map(d => d.index === index ? { ...d, action } : d))
  }

  async function applyImport() {
    setApplying(true)
    setMsg({ type: 'info', text: '匯入中…' })

    try {
      const payload = decisions.map(d => ({
        item: d.incoming,
        action: d.action,
        existingId: d.existing?.id,
      }))

      const res = await fetch('/api/products/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload }),
      })
      const data = await res.json() as { results?: ImportResult[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? '匯入失敗')

      setResults(data.results!)
      setStep('done')
      const created = data.results!.filter(r => r.action === 'created').length
      const updated = data.results!.filter(r => r.action === 'updated').length
      const kept = data.results!.filter(r => r.action === 'kept').length
      const skipped = data.results!.filter(r => r.action === 'skip').length
      setMsg({ type: 'ok', text: `完成！新建 ${created}，更新 ${updated}，保留 ${kept}，略過 ${skipped}。` })
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setApplying(false)
    }
  }

  const newCount = decisions.filter(d => !d.conflict).length
  const conflictCount = decisions.filter(d => d.conflict).length

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
        <div>
          <h1 className="text-xl font-semibold">✨ AI 批量匯入產品</h1>
          <p className="text-sm text-gray-500">上傳供應商報價單或產品目錄，AI 自動建立產品資料</p>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${
          msg.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-700' :
          msg.type === 'err' ? 'bg-red-50 border border-red-200 text-red-700' :
          'bg-blue-50 border border-blue-200 text-blue-700'
        }`}>{msg.text}</div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.txt"
            onChange={handleFile} />
          <p className="text-4xl mb-3">📄</p>
          <p className="text-gray-600 font-medium">{parsing ? 'AI 解析中…' : '點擊或拖放檔案'}</p>
          <p className="text-xs text-gray-400 mt-1">支援 PDF、Excel (.xlsx/.xls)、CSV、圖片</p>
        </div>
      )}

      {/* Step 2: Preview with conflict UI */}
      {step === 'preview' && decisions.length > 0 && (
        <div className="space-y-4">
          {/* 統計 */}
          <div className="flex gap-3 text-sm">
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full">{newCount} 項新產品</span>
            {conflictCount > 0 && (
              <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full">{conflictCount} 項衝突需確認</span>
            )}
          </div>

          {/* 新產品（無衝突）*/}
          {newCount > 0 && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="px-4 py-3 border-b bg-green-50">
                <h3 className="text-sm font-semibold text-green-800">新產品（將直接建立）</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">品名</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">SKU</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">單價</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">單位</th>
                    <th className="px-4 py-2 font-medium text-gray-600 text-center">動作</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.filter(d => !d.conflict).map(d => (
                    <tr key={d.index} className="border-t">
                      <td className="px-4 py-2">
                        <div className="font-medium">{d.incoming.name ?? '—'}</div>
                        {d.incoming.specification && <div className="text-xs text-gray-400 truncate max-w-[240px]">{d.incoming.specification}</div>}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-500">{d.incoming.sku ?? '—'}</td>
                      <td className="px-4 py-2 text-right">{d.incoming.unitPrice ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-500">{d.incoming.unit ?? 'PCS'}</td>
                      <td className="px-4 py-2 text-center">
                        <select
                          value={d.action}
                          onChange={e => setAction(d.index, e.target.value as Action)}
                          className="text-xs border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="create">建立</option>
                          <option value="skip">略過</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 衝突項目 */}
          {conflictCount > 0 && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="px-4 py-3 border-b bg-amber-50">
                <h3 className="text-sm font-semibold text-amber-800">衝突項目（請選擇處理方式）</h3>
                <p className="text-xs text-amber-600 mt-0.5">「更新」會用新資料覆蓋，並寫入歷史快照。「保留」只記錄歷史快照。</p>
              </div>
              <div className="divide-y">
                {decisions.filter(d => d.conflict).map(d => (
                  <div key={d.index} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                          {d.conflictType === 'sku' ? 'SKU 重複' : '品名重複'}
                        </span>
                      </div>
                      <select
                        value={d.action}
                        onChange={e => setAction(d.index, e.target.value as Action)}
                        className="text-sm border border-gray-300 rounded px-3 py-1.5 font-medium"
                      >
                        <option value="keep">保留現有，記錄歷史</option>
                        <option value="update">沿用新資料並記錄歷史</option>
                        <option value="skip">略過</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-gray-50 rounded p-3">
                        <div className="text-xs font-medium text-gray-500 mb-2">現有資料</div>
                        <CompareRow label="品名" value={d.existing?.name} />
                        <CompareRow label="SKU" value={d.existing?.sku} mono />
                        <CompareRow label="規格" value={d.existing?.specification} />
                        <CompareRow label="單位" value={d.existing?.unit} />
                        <CompareRow label="成本" value={d.existing?.unitCost} />
                      </div>
                      <div className={`rounded p-3 ${d.action === 'update' ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                        <div className="text-xs font-medium text-gray-500 mb-2">匯入資料</div>
                        <CompareRow label="品名" value={d.incoming.name} highlight={d.action === 'update' && d.incoming.name !== d.existing?.name} />
                        <CompareRow label="SKU" value={d.incoming.sku} mono highlight={d.action === 'update' && d.incoming.sku !== d.existing?.sku} />
                        <CompareRow label="規格" value={d.incoming.specification} highlight={d.action === 'update' && d.incoming.specification !== d.existing?.specification} />
                        <CompareRow label="單位" value={d.incoming.unit} highlight={d.action === 'update' && d.incoming.unit !== d.existing?.unit} />
                        <CompareRow label="單價" value={d.incoming.unitPrice?.toString()} highlight={d.action === 'update'} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={applyImport} disabled={applying}
              className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {applying ? '匯入中…' : `確認匯入（${decisions.filter(d => d.action !== 'skip').length} 項）`}
            </button>
            <button onClick={() => { setStep('upload'); setDecisions([]); setMsg(null) }}
              className="border border-gray-300 text-gray-600 px-5 py-2 rounded-md text-sm hover:bg-gray-50">
              重新上傳
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 'done' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">品名</th>
                  <th className="text-left px-4 py-2 font-medium">SKU</th>
                  <th className="text-left px-4 py-2 font-medium">結果</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.sku ?? '—'}</td>
                    <td className="px-4 py-2">
                      {r.action === 'created' && <span className="text-green-600 font-medium">✓ 新建</span>}
                      {r.action === 'updated' && <span className="text-blue-600 font-medium">↑ 已更新</span>}
                      {r.action === 'kept'    && <span className="text-gray-500">保留（歷史已記錄）</span>}
                      {r.action === 'skip'   && <span className="text-gray-400">略過（{r.reason}）</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push('/products')}
              className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
              查看商品列表
            </button>
            <button onClick={() => { setStep('upload'); setDecisions([]); setResults([]); setMsg(null) }}
              className="border border-gray-300 text-gray-600 px-5 py-2 rounded-md text-sm hover:bg-gray-50">
              繼續匯入
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CompareRow({ label, value, mono, highlight }: { label: string; value?: string | null; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex gap-2 py-0.5 text-xs">
      <span className="text-gray-400 w-10 shrink-0">{label}</span>
      <span className={`${mono ? 'font-mono' : ''} ${highlight ? 'font-semibold text-blue-700' : 'text-gray-700'}`}>
        {value ?? <span className="text-gray-300">—</span>}
      </span>
    </div>
  )
}
