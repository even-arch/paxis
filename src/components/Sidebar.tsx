'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'

type NavItem = { label: string; href: string; icon: string; exact?: boolean }
type NavGroup = { section: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    section: '',
    items: [
      { label: '總覽', href: '/dashboard', icon: '📊', exact: true },
    ],
  },
  {
    section: '商品與庫存',
    items: [
      { label: '商品管理', href: '/products', icon: '📦' },
      { label: '庫存管理', href: '/inventory', icon: '🗃️' },
    ],
  },
  {
    section: '客戶端',
    items: [
      { label: '客戶', href: '/customers', icon: '🤝' },
      { label: '客戶訂單', href: '/sales', icon: '📋' },
      { label: '匯入出貨文件', href: '/sales/shipment-import', icon: '🗂️' },
    ],
  },
  {
    section: '供應商端',
    items: [
      { label: '供應商', href: '/suppliers', icon: '🏭' },
      { label: '採購訂單', href: '/purchases', icon: '🛒' },
    ],
  },
  {
    section: '物流',
    items: [
      { label: 'UPS 出貨', href: '/shipping', icon: '🚚' },
    ],
  },
  {
    section: '財務',
    items: [
      { label: '對帳 / 付款', href: '/finance', icon: '💳' },
      { label: '到岸成本試算', href: '/cost', icon: '🧮' },
    ],
  },
]

const settingsItems: NavItem[] = [
  { label: '公司資料', href: '/settings/company', icon: '🏢' },
  { label: 'AI 功能', href: '/settings/ai', icon: '✨' },
  { label: 'Email 寄信', href: '/settings/email', icon: '📧' },
  { label: 'Patisco 同步', href: '/settings/patisco', icon: '🔗' },
  { label: '個人設定', href: '/settings/profile', icon: '👤' },
  { label: '管理後台', href: '/admin', icon: '⚙️' },
]

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href
  if (pathname === item.href) return true
  // 「匯入出貨文件」是精確路徑，不要讓 /sales 把它吃掉
  if (item.href === '/sales') {
    return pathname.startsWith('/sales/') && pathname !== '/sales/shipment-import'
  }
  return pathname.startsWith(item.href + '/')
}

export default function Sidebar({ companyName = 'PAXIS' }: { companyName?: string }) {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col">
      <div className="px-5 py-4 border-b border-gray-700">
        <h1 className="text-lg font-bold">PAXIS</h1>
        <p className="text-xs text-gray-400">{companyName}</p>
      </div>

      <nav className="flex-1 py-4 px-2 flex flex-col gap-0.5 overflow-y-auto">
        {navGroups.map(group => (
          <div key={group.section}>
            {group.section && (
              <div className="mt-4 mb-1 px-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {group.section}
                </span>
              </div>
            )}
            {group.items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive(pathname, item)
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800',
                )}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}

        <div className="mt-4 mb-1 px-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">設定</span>
        </div>
        {settingsItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              isActive(pathname, item)
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800',
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-gray-700 space-y-2">
        {session?.user && (
          <p className="text-xs text-gray-500 truncate px-1">{session.user.email}</p>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-800"
        >
          <span>🚪</span>
          <span>登出</span>
        </button>
      </div>
    </aside>
  )
}
