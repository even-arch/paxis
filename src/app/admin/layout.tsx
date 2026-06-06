import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 頂部導覽 */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-gray-800">PAXIS Admin</span>
        <nav className="flex gap-4 text-sm">
          <Link href="/admin/tenants" className="text-gray-600 hover:text-blue-600">租戶管理</Link>
          <Link href="/admin/settings" className="text-gray-600 hover:text-blue-600">系統設定</Link>
        </nav>
        <div className="ml-auto">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">← 回主系統</Link>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
