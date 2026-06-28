'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import NotificationBell from './NotificationBell'

type NavItem  = { label: string; href: string; icon: string; exact?: boolean; absolute?: boolean }
type NavGroup = { section: string; items: NavItem[] }

// href 是相對路徑（不含 orgSlug），由 Sidebar 動態加前綴
// ── B2B 導覽（貿易 / Patisco 整合）────────────────────────────────
const b2bGroups: NavGroup[] = [
  {
    section: '',
    items: [
      { label: '總覽',     href: '/dashboard', icon: '📊', exact: true },
      { label: '資料警示', href: '/alerts',    icon: '⚠️' },
    ],
  },
  {
    section: '商品與庫存',
    items: [
      { label: '商品管理', href: '/products',   icon: '📦' },
      { label: '庫存管理', href: '/inventory',  icon: '🗃️' },
    ],
  },
  {
    section: '客戶端',
    items: [
      { label: '客戶',      href: '/customers', icon: '🤝' },
      { label: '客戶訂單',  href: '/sales',     icon: '📋' },
      { label: '我方 PI',   href: '/sales/pi',  icon: '📄' },
    ],
  },
  {
    section: '供應商端',
    items: [
      { label: '供應商',    href: '/suppliers', icon: '🏭' },
      { label: '採購訂單',  href: '/purchases', icon: '🛒' },
    ],
  },
  {
    section: '物流',
    items: [
      { label: '出貨單', href: '/shipments', icon: '📦' },
      { label: '簡易出貨單', href: '/delivery-notes', icon: '🧾' },
      { label: 'UPS 出貨', href: '/shipping', icon: '🚚' },
    ],
  },
  {
    section: '財務',
    items: [
      { label: '對帳 / 付款',   href: '/finance',          icon: '💳' },
      { label: '損益報表',      href: '/finance/pl',       icon: '📊' },
      { label: '付款通知單',    href: '/finance/vouchers', icon: '📋' },
      { label: '到岸成本試算',  href: '/cost',             icon: '🧮' },
    ],
  },
]

// ── B2C 導覽（電商 / Shopee）─────────────────────────────────────
const b2cGroups: NavGroup[] = [
  {
    section: '',
    items: [
      { label: '電商總覽', href: '/marketplace', icon: '📊', exact: true },
    ],
  },
  {
    section: 'Shopee',
    items: [
      { label: '訂單列表',  href: '/marketplace/orders',   icon: '🛍️' },
      { label: '待出貨',    href: '/marketplace/pending',  icon: '📦' },
      { label: '面單管理',  href: '/marketplace/waybills', icon: '🏷️' },
    ],
  },
  {
    section: '庫存',
    items: [
      { label: '庫存查看', href: '/marketplace/inventory', icon: '🗃️' },
    ],
  },
  {
    section: '設定',
    items: [
      { label: 'SKU 對照表',  href: '/marketplace/settings/sku',     icon: '🔗' },
      { label: 'API 憑證',    href: '/marketplace/settings/api',     icon: '🔑' },
    ],
  },
]

const settingsItems: NavItem[] = [
  { label: '公司資料',    href: '/settings/company',  icon: '🏢' },
  { label: 'AI 功能',    href: '/settings/ai',        icon: '✨' },
  { label: 'Email 寄信', href: '/settings/email',     icon: '📧' },
  { label: 'Patisco 同步', href: '/settings/patisco', icon: '🔗' },
  { label: '列印模板',   href: '/settings/templates', icon: '🖨' },
  { label: '費用模板',   href: '/settings/charge-templates', icon: '💰' },
  { label: '個人設定',   href: '/settings/profile',   icon: '👤' },
  { label: '管理後台',   href: '/admin',              icon: '⚙️' },
]

function isActive(pathname: string, item: NavItem, base: string): boolean {
  const full = item.absolute ? item.href : base + item.href
  if (item.exact) return pathname === full
  if (pathname === full) return true
  if (item.href === '/sales') return pathname.startsWith(base + '/sales/')
  return pathname.startsWith(full + '/')
}

function NavLinks({ groups, pathname, base }: { groups: NavGroup[]; pathname: string; base: string }) {
  return (
    <>
      {groups.map(group => (
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
              href={base + item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive(pathname, item, base)
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
    </>
  )
}

type Mode = 'b2b' | 'b2c'

export default function Sidebar({ companyName = 'PAXIS', orgSlug = '' }: { companyName?: string; orgSlug?: string }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const base      = orgSlug ? `/${orgSlug}` : ''
  const { data: session } = useSession()

  // 根據目前路徑自動判斷模式；否則從 localStorage 讀取；預設 b2b
  const detectMode = (): Mode => {
    if (pathname.startsWith('/marketplace')) return 'b2c'
    return 'b2b'
  }

  const [mode, setMode] = useState<Mode>('b2b')

  // 初始化：路徑優先，其次 localStorage
  useEffect(() => {
    if (pathname.startsWith(base + '/marketplace')) {
      setMode('b2c')
    } else {
      const saved = localStorage.getItem('paxis_mode') as Mode | null
      if (saved === 'b2c' && !pathname.startsWith(base + '/marketplace')) {
        setMode('b2b')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 路徑變化時同步模式
  useEffect(() => {
    if (pathname.startsWith(base + '/marketplace')) {
      setMode('b2c')
    }
  }, [pathname, base])

  function switchMode(next: Mode) {
    setMode(next)
    localStorage.setItem('paxis_mode', next)
    if (next === 'b2c') router.push(base + '/marketplace')
    else                router.push(base + '/dashboard')
  }

  const isB2B = mode === 'b2b'

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col">

      {/* ── 頂部 Logo ── */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-700 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold">PAXIS</h1>
          <p className="text-xs text-gray-400">{companyName}</p>
        </div>
        <NotificationBell />
      </div>

      {/* ── 導覽項目 ── */}
      <nav className="flex-1 py-4 px-2 flex flex-col gap-0.5 overflow-y-auto">
        <NavLinks groups={b2bGroups} pathname={pathname} base={base} />
        <div className="mt-4 mb-1 px-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">設定</span>
        </div>
        {settingsItems.map(item => (
          <Link
            key={item.href}
            href={item.absolute ? item.href : base + item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              isActive(pathname, item, base)
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800',
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* ── 底部登出 ── */}
      <div className="px-3 py-4 border-t border-gray-700 space-y-2">
        {session?.user && (
          <p className="text-xs text-gray-500 truncate px-1">{session.user.email}</p>
        )}
        <button
          onClick={() => signOut({ callbackUrl: base + '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-800"
        >
          <span>🚪</span>
          <span>登出</span>
        </button>
      </div>
    </aside>
  )
}
