'use client'

import { useRouter } from 'next/navigation'

export default function DeleteCostButton({ sheetId }: { sheetId: string }) {
  const router = useRouter()
  async function handleDelete() {
    if (!confirm('確定刪除此試算表？')) return
    const res = await fetch(`/api/cost/${sheetId}`, { method: 'DELETE' })
    if (res.ok) { router.push('/cost'); router.refresh() }
  }
  return (
    <button onClick={handleDelete}
      className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-md text-sm hover:bg-red-100 print:hidden">
      刪除
    </button>
  )
}
