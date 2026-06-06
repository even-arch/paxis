'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: '總覽', href: '/dashboard', icon: '📊' },
  { label: '商品管理', href: '/products', icon: '📦' },
  { label: '供應商', href: '/suppliers', icon: '🏭' },
  { label: '客戶', href: '/customers', icon: '🤝' },
  { label: '客戶訂單', href: '/sales', icon: '📤' },
  { label: '供應商訂單', href: '/purchases', icon: '🛒' },
  { label: '庫存管理', href: '/inventory', icon: '🗃️' },
  { label: '對帳 / 付款', href: '/finance', icon: '💳' },
  { label: '到岸成本試算', href: '/cost', icon: '🧮' },
  { label: 'UPS 出貨查詢', href: '/shipping', icon: '🚚' },
]

const settingsItems = [
  { label: '公司資料', href: '/settings/company', icon: '🏢' },
  { label: 'AI 功能', href: '/settings/ai', icon: '✨' },
  { label: 'Email 寄信', href: '/settings/email', icon: '📧' },
  { label: 'Patisco 同步', href: '/settings/patisco', icon: '🔗' },
  { label: '個人設定', href: '/settings/profile', icon: '👤' },
]

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
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              pathname.startsWith(item.href)
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800',
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
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
              pathname.startsWith(item.href)
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
