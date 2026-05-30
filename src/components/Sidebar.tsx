'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: '總覽', href: '/dashboard', icon: '📊' },
  { label: '商品管理', href: '/products', icon: '📦' },
  { label: '供應商', href: '/suppliers', icon: '🏭' },
  { label: '採購單', href: '/purchases', icon: '🛒' },
  { label: '庫存管理', href: '/inventory', icon: '🗃️' },
  { label: '成本計算', href: '/cost', icon: '💰' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col">
      <div className="px-5 py-4 border-b border-gray-700">
        <h1 className="text-lg font-bold">PAXIS</h1>
        <p className="text-xs text-gray-400">錫諾系統進銷存</p>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2">
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
      </nav>

      <div className="px-2 py-4 border-t border-gray-700">
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
