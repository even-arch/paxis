'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SOImportButton({ shipmentId, hasSoData }: { shipmentId: number; hasSoData?: boolean }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(file: File) {
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/shipments/${shipmentId}/so-import`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '匯入失敗')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '匯入失敗')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleClear() {
    if (!window.confirm('確定要清空此出貨單的船務資訊（SO）嗎？\n清空後可重新匯入新的 SO 文件。')) return
    setClearing(true)
    setError('')
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/so-import`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '清空失敗')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '清空失敗')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".docx,.pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      {hasSoData && (
        <button
          onClick={handleClear}
          disabled={clearing || uploading}
          className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-600 disabled:opacity-50">
          {clearing ? '清空中...' : '🗑 清空 SO 資料'}
        </button>
      )}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading || clearing}
        className="text-xs px-3 py-1.5 rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
        {uploading ? 'AI 解析中...' : hasSoData ? '📄 重新匯入 SO' : '📄 匯入 SO（裝船通知單）'}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
