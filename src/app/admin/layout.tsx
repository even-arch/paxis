import Link from 'next/link'

// Auth 檢查在各頁面的 Server Component 做，這裡只提供 layout 框架
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center">
        <span className="font-bold text-gray-800 text-sm">PAXIS 管理後台</span>
        <div className="ml-auto">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">← 回主系統</Link>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
