'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useOrgPath } from '@/lib/use-org-path'

type CustomerDefault = {
  id: number
  customerId: number
  customerName: string
  customerShortName: string | null
  docType: string
  freeFields: Record<string, string>
  updatedAt: string
}

type TemplateRow = {
  id: number
  name: string
  docType: string
  isDefault: boolean
  isSystem: boolean
  createdAt: string
}

type AnalysisResult = {
  templateName: string
  htmlBody: string
  freeFields: { key: string; label: string; defaultValue: string }[]
  analysisNote: string
}

const DOC_LABEL: Record<string, string> = {
  SLS_PI: 'Proforma Invoice (PI)',
  PO_ORDER: '採購單 (PO)',
}

const FIELD_LABELS: Record<string, string> = {
  portOfLoading: 'Port of Loading',
  portOfDischarge: 'Port of Discharge',
  countryOfOrigin: 'Country of Origin',
  shippingMarks: 'Shipping Marks',
  remarks: 'Remarks',
}

export default function TemplatesClient({
  customerDefaults,
  templates,
}: {
  customerDefaults: CustomerDefault[]
  templates: TemplateRow[]
}) {
  const router = useRouter()
  const go = useOrgPath()
  const [tab, setTab] = useState<'templates' | 'defaults'>('templates')
  const [pending, startTransition] = useTransition()

  // ── AI 匯入狀態 ──
  const fileRef = useRef<HTMLInputElement>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [analysisError, setAnalysisError] = useState('')
  const [previewMode, setPreviewMode] = useState<'visual' | 'code' | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [editName, setEditName] = useState('')
  const [setAsDefault, setSetAsDefault] = useState(true)

  // ── 客戶預設值 ──
  const [expandedDefaultId, setExpandedDefaultId] = useState<number | null>(null)
  const [deletingDefaultId, setDeletingDefaultId] = useState<number | null>(null)

  async function handleAnalyze() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setAnalysisError('請選擇檔案'); return }
    setAnalyzing(true); setAnalysisError(''); setAnalysisResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/ai/analyze-template', { method: 'POST', body: fd })
      const json = await res.json() as AnalysisResult & { error?: string }
      if (!res.ok || json.error) throw new Error(json.error ?? '分析失敗')
      setAnalysisResult(json)
      setEditName(json.templateName)
      setPreviewMode('visual')
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : String(e))
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSaveTemplate() {
    if (!analysisResult || !editName.trim()) return
    setSavingTemplate(true)
    try {
      const res = await fetch('/api/print/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          docType: 'SLS_PI',
          htmlBody: analysisResult.htmlBody,
          freeFields: analysisResult.freeFields,
          setAsDefault,
        }),
      })
      if (!res.ok) throw new Error('儲存失敗')
      setAnalysisResult(null)
      startTransition(() => router.refresh())
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingTemplate(false)
    }
  }

  async function handleSetDefault(id: number) {
    await fetch(`/api/print/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setAsDefault: true }),
    })
    startTransition(() => router.refresh())
  }

  async function handleDeleteTemplate(id: number) {
    if (!confirm('確定要刪除此模板？')) return
    await fetch(`/api/print/templates/${id}`, { method: 'DELETE' })
    startTransition(() => router.refresh())
  }

  async function handleDeleteDefault(id: number) {
    if (!confirm('確定要刪除此預設值？')) return
    setDeletingDefaultId(id)
    await fetch(`/api/customers/print-defaults/${id}`, { method: 'DELETE' })
    setDeletingDefaultId(null)
    startTransition(() => router.refresh())
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">列印模板管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理公司級列印模板及各客戶的補充資訊預設值</p>
        </div>
      </div>

      {/* Tab */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {([['templates', '🖨 列印模板'], ['defaults', '👥 客戶預設值']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── 列印模板 Tab ── */}
      {tab === 'templates' && (
        <div className="space-y-6">
          {/* AI 匯入區 */}
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">✨ AI 匯入新模板</h2>
            <p className="text-xs text-gray-400 mb-4">上傳現有 PI 文件的截圖或圖片，AI 自動分析版面並生成可用模板</p>

            <div className="flex items-center gap-3 mb-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:text-sm file:bg-gray-50 hover:file:bg-gray-100"
              />
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
              >
                {analyzing ? '✨ 分析中…' : '✨ 開始分析'}
              </button>
            </div>

            {analysisError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">
                {analysisError}
              </div>
            )}

            {/* 分析結果 */}
            {analysisResult && (
              <div className="border-2 border-indigo-300 rounded-lg mt-2 overflow-hidden">
                {/* 審視工具列 */}
                <div className="bg-indigo-600 text-white px-4 py-3 flex items-center gap-3">
                  <span className="text-sm font-medium">✨ AI 分析完成 — 請確認版面後再儲存</span>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => setPreviewMode(previewMode === 'visual' ? null : 'visual')}
                      className={`text-xs px-3 py-1 rounded border ${previewMode === 'visual' ? 'bg-white text-indigo-700 border-white' : 'border-indigo-400 text-indigo-100 hover:bg-indigo-700'}`}
                    >
                      👁 視覺預覽
                    </button>
                    <button
                      onClick={() => setPreviewMode(previewMode === 'code' ? null : 'code')}
                      className={`text-xs px-3 py-1 rounded border ${previewMode === 'code' ? 'bg-white text-indigo-700 border-white' : 'border-indigo-400 text-indigo-100 hover:bg-indigo-700'}`}
                    >
                      {'</>'} HTML
                    </button>
                  </div>
                </div>

                {/* 視覺預覽 */}
                {previewMode === 'visual' && (
                  <div className="bg-gray-200 p-4">
                    <div className="text-xs text-gray-500 text-center mb-2">↓ 模板預覽（使用範例資料填充佔位符）</div>
                    <div className="bg-white shadow-lg mx-auto overflow-auto" style={{ maxHeight: '500px' }}>
                      <iframe
                        srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:20px;font-size:9pt;font-family:Arial,sans-serif}</style></head><body>${analysisResult.htmlBody}</body></html>`}
                        style={{ width: '100%', minHeight: '480px', border: 'none' }}
                        title="模板預覽"
                      />
                    </div>
                  </div>
                )}

                {/* 原始碼 */}
                {previewMode === 'code' && (
                  <pre className="text-xs bg-gray-900 text-green-300 p-4 overflow-auto max-h-72">
                    {analysisResult.htmlBody}
                  </pre>
                )}

                {/* 儲存區 */}
                <div className="bg-indigo-50 border-t border-indigo-200 p-4 space-y-3">
                  {analysisResult.analysisNote && (
                    <div className="text-xs text-gray-600 bg-white border border-indigo-100 rounded px-3 py-2">
                      <span className="font-medium text-indigo-700">AI 說明：</span>{analysisResult.analysisNote}
                    </div>
                  )}

                  {analysisResult.freeFields.length > 0 && (
                    <div className="text-xs text-gray-500">
                      自由欄位（每次列印前填入）：
                      <span className="text-gray-700 font-medium ml-1">
                        {analysisResult.freeFields.map(f => f.label).join('、')}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs text-gray-500 mb-1">模板名稱</label>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder="輸入模板名稱"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <input
                        type="checkbox"
                        id="setDefault"
                        checked={setAsDefault}
                        onChange={e => setSetAsDefault(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="setDefault" className="text-xs text-gray-600 whitespace-nowrap">設為預設模板</label>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveTemplate}
                      disabled={savingTemplate || !editName.trim()}
                      className="bg-blue-600 text-white text-sm px-5 py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
                    >
                      {savingTemplate ? '儲存中…' : '💾 確認儲存模板'}
                    </button>
                    <button
                      onClick={() => { setAnalysisResult(null); setPreviewMode(null) }}
                      className="border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded hover:bg-gray-50"
                    >
                      捨棄，重新上傳
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 現有模板列表 */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              已儲存模板
            </h2>
            {templates.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400 text-sm">
                尚無模板，請使用上方 AI 匯入功能建立第一個模板
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">模板名稱</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">類型</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">狀態</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">建立時間</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {templates.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-800">{t.name}</td>
                        <td className="px-5 py-3 text-gray-500">{DOC_LABEL[t.docType] ?? t.docType}</td>
                        <td className="px-5 py-3">
                          {t.isDefault
                            ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">預設</span>
                            : <span className="text-xs text-gray-400">—</span>
                          }
                          {t.isSystem && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full ml-1">系統</span>}
                        </td>
                        <td className="px-5 py-3 text-gray-400 text-xs">
                          {new Date(t.createdAt).toLocaleDateString('zh-TW')}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center gap-3 justify-end">
                            {!t.isDefault && (
                              <button
                                onClick={() => handleSetDefault(t.id)}
                                disabled={pending}
                                className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
                              >
                                設為預設
                              </button>
                            )}
                            {!t.isSystem && (
                              <button
                                onClick={() => handleDeleteTemplate(t.id)}
                                disabled={pending}
                                className="text-xs text-red-400 hover:text-red-600 hover:underline"
                              >
                                刪除
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 客戶預設值 Tab ── */}
      {tab === 'defaults' && (
        <div>
          {customerDefaults.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">👥</div>
              <div className="text-sm">尚無客戶列印預設值</div>
              <div className="text-xs text-gray-400 mt-1">
                前往客戶的 PI 列印頁面，填寫補充資訊後點「儲存為預設值」即可建立
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">客戶</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">單據類型</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">已設定欄位</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">最後更新</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customerDefaults.map(row => {
                    const filledFields = Object.entries(row.freeFields).filter(([, v]) => v)
                    const isExpanded = expandedDefaultId === row.id
                    return (
                      <>
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3">
                            <Link href={go(`/customers/${row.customerId}`)} className="font-medium text-blue-600 hover:underline">
                              {row.customerName}
                            </Link>
                            {row.customerShortName && (
                              <span className="text-gray-400 text-xs ml-1">({row.customerShortName})</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-gray-500">{DOC_LABEL[row.docType] ?? row.docType}</td>
                          <td className="px-5 py-3">
                            {filledFields.length === 0 ? (
                              <span className="text-gray-300">—</span>
                            ) : (
                              <button
                                onClick={() => setExpandedDefaultId(isExpanded ? null : row.id)}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                {filledFields.length} 個欄位 {isExpanded ? '▲' : '▼'}
                              </button>
                            )}
                          </td>
                          <td className="px-5 py-3 text-gray-400 text-xs">
                            {new Date(row.updatedAt).toLocaleDateString('zh-TW')}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => handleDeleteDefault(row.id)}
                              disabled={deletingDefaultId === row.id}
                              className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-50"
                            >
                              {deletingDefaultId === row.id ? '刪除中…' : '刪除'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${row.id}-detail`} className="bg-blue-50">
                            <td colSpan={5} className="px-5 py-3">
                              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
                                {filledFields.map(([key, value]) => (
                                  <div key={key} className="flex gap-2">
                                    <span className="text-gray-500 min-w-[130px]">
                                      {FIELD_LABELS[key] ?? key}:
                                    </span>
                                    <span className="text-gray-800 font-medium">{value}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
