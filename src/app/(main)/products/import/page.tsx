'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { ParsedInvoice } from '@/app/api/ai/parse-invoice/route'

interface ImportedProduct {
  name: string; sku: string | null; qty: number | null
  unitPrice: number | null; unit: string | null
  created?: boolean; productId?: number; skipped?: boolean; reason?: string
}

export default function ProductImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [parsing, setparsing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null)
  const [parsed, setParsed] = useState<ParsedInvoice | null>(null)
  const [results, setResults] = useState<ImportedProduct[]>([])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setparsing(true)
    setMsg({ type: 'info', text: `AI 解析中：${file.name}…` })

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/ai/parse-invoice', { method: 'POST', body: fd })
      const d = await res.json() as { data?: ParsedInvoice; error?: string }
      if (!res.ok) throw new Error(d.error ?? '解析失敗')
      setParsed(d.data!)
      setStep('preview')
      setMsg({ type: 'ok', text: `解析完成，找到 ${d.data!.items.length} 項產品，請確認後匯入。` })
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setparsing(false)
    }
  }

  async function applyImport() {
    if (!parsed) return
    setApplying(true)
    setMsg({ type: 'info', text: '匯入中…' })

    try {
      const res = await fetch('/api/products/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: parsed.items }),
      })
      const d = await res.json() as { results?: ImportedProduct[]; error?: string }
      if (!res.ok) throw new Error(d.error ?? '匯入失敗')
      setResults(d.results!)
      setStep('done')
      setMsg({ type: 'ok', text: `匯入完成！新建 ${d.results!.filter(r => r.created).length} 項，略過 ${d.results!.filter(r => r.skipped).length} 項重複。` })
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl">
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

      {step === 'preview' && parsed && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">品名</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">料號 (SKU)</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">數量</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">單價</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">單位</th>
                </tr>
              </thead>
              <tbody>
                {parsed.items.filter(it => it).map((it, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2">{it.description ?? '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{it.sku ?? '—'}</td>
                    <td className="px-4 py-2 text-right">{it.qty ?? 0}</td>
                    <td className="px-4 py-2 text-right">{it.unitPrice ?? 0}</td>
                    <td className="px-4 py-2 text-gray-500">{it.unit ?? 'PCS'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">
            料號 (SKU) 不可重複。若已存在相同 SKU，該項目將略過（不會覆蓋）。
          </p>
          <div className="flex gap-3">
            <button onClick={applyImport} disabled={applying}
              className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {applying ? '匯入中…' : `確認匯入 ${parsed.items.length} 項`}
            </button>
            <button onClick={() => { setStep('upload'); setParsed(null); setMsg(null) }}
              className="border border-gray-300 text-gray-600 px-5 py-2 rounded-md text-sm hover:bg-gray-50">
              重新上傳
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">品名</th>
                  <th className="text-left px-4 py-2 font-medium">SKU</th>
                  <th className="text-left px-4 py-2 font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.sku ?? '—'}</td>
                    <td className="px-4 py-2">
                      {r.created
                        ? <span className="text-green-600 font-medium">✓ 新建</span>
                        : <span className="text-gray-400">略過（{r.reason}）</span>
                      }
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
            <button onClick={() => { setStep('upload'); setParsed(null); setResults([]); setMsg(null) }}
              className="border border-gray-300 text-gray-600 px-5 py-2 rounded-md text-sm hover:bg-gray-50">
              繼續匯入
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
