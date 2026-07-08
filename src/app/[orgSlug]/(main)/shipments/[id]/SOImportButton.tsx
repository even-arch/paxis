'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SOImportButton({ shipmentId }: { shipmentId: number }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
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

  return (
    <div className="inline-flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".docx,.pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="text-xs px-3 py-1.5 rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
        {uploading ? 'AI 解析中...' : '📄 匯入 SO（裝船通知單）'}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
