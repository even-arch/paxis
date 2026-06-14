import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminToken, ADMIN_COOKIE } from '@/lib/admin-auth'
import AdminLogout from './AdminLogout'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // /admin/login 不需要驗證
  return <AdminLayoutInner>{children}</AdminLayoutInner>
}

async function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  // 從 request URL 判斷是否為 login 頁（Server Component 無法直接讀 pathname，透過 cookie 判斷）
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE)?.value
  const isAuthed = token ? verifyAdminToken(token) : false

  // 登入頁永遠可以看，其他頁面需要驗證（由各頁面呼叫 requireAdminAuth 處理）

  return (
    <div className="min-h-screen bg-gray-50">
      {isAuthed && (
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
          <span className="font-bold text-gray-800 text-sm">PAXIS 管理後台</span>
          <nav className="flex gap-3 text-sm text-gray-600">
            <Link href="/admin/tenants" className="hover:text-blue-600">租戶管理</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <AdminLogout />
          </div>
        </header>
      )}
      <main className="p-6">{children}</main>
    </div>
  )
}
