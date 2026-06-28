'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import NotificationBell from './NotificationBell'

type NavItem  = { label: string; href: string; icon: string; exact?: boolean; absolute?: boolean }
type NavGroup = { section: string; items: NavItem[]; key: string }

const b2bGroups: NavGroup[] = [
  {
    key: 'overview',
    section: '',
    items: [
      { label: '總覽',     href: '/dashboard', icon: '📊', exact: true },
      { label: '資料警示', href: '/alerts',    icon: '⚠️' },
    ],
  },
  {
    key: 'products',
    section: '商品與庫存',
    items: [
      { label: '商品管理', href: '/products',  icon: '📦' },
      { label: '庫存管理', href: '/inventory', icon: '🗃️' },
    ],
  },
  {
    key: 'sales',
    section: '客戶端',
    items: [
      { label: '客戶',     href: '/customers', icon: '🤝' },
      { label: '客戶訂單', href: '/sales',     icon: '📋' },
      { label: '我方 PI',  href: '/sales/pi',  icon: '📄' },
    ],
  },
  {
    key: 'purchase',
    section: '供應商端',
    items: [
      { label: '供應商',   href: '/suppliers', icon: '🏭' },
      { label: '採購訂單', href: '/purchases', icon: '🛒' },
    ],
  },
  {
    key: 'logistics',
    section: '物流',
    items: [
      { label: '出貨單',     href: '/shipments',      icon: '📦' },
      { label: '簡易出貨單', href: '/delivery-notes', icon: '🧾' },
      { label: 'UPS 出貨',  href: '/shipping',        icon: '🚚' },
    ],
  },
  {
    key: 'finance',
    section: '財務',
    items: [
      { label: '對帳 / 付款',  href: '/finance',          icon: '💳' },
      { label: '損益報表',     href: '/finance/pl',       icon: '📊' },
      { label: '付款通知單',   href: '/finance/vouchers', icon: '📋' },
      { label: '到岸成本試算', href: '/cost',             icon: '🧮' },
    ],
  },
]

const settingsItems: NavItem[] = [
  { label: '公司資料',    href: '/settings/company',          icon: '🏢' },
  { label: 'AI 功能',    href: '/settings/ai',               icon: '✨' },
  { label: 'Email 寄信', href: '/settings/email',            icon: '📧' },
  { label: 'Patisco 同步', href: '/settings/patisco',        icon: '🔗' },
  { label: '列印模板',   href: '/settings/templates',        icon: '🖨' },
  { label: '費用模板',   href: '/settings/charge-templates', icon: '💰' },
  { label: '個人設定',   href: '/settings/profile',          icon: '👤' },
  { label: '管理後台',   href: '/admin',                     icon: '⚙️' },
]

function isActive(pathname: string, item: NavItem, base: string): boolean {
  const full = item.absolute ? item.href : base + item.href
  if (item.exact) return pathname === full
  if (pathname === full) return true
  if (item.href === '/sales') return pathname.startsWith(base + '/sales/')
  return pathname.startsWith(full + '/')
}

function CollapseIcon({ open }: { open: boolean }) {
  return (
    <svg className={cn('w-3 h-3 text-gray-500 transition-transform', open ? 'rotate-0' : '-rotate-90')}
      viewBox="0 0 10 10" fill="currentColor">
      <path d="M5 7L1 3h8L5 7z" />
    </svg>
  )
}

function NavLinks({ groups, pathname, base, collapsed, onToggle }: {
  groups: NavGroup[]
  pathname: string
  base: string
  collapsed: Record<string, boolean>
  onToggle: (key: string) => void
}) {
  return (
    <>
      {groups.map(group => {
        const isOpen = !collapsed[group.key]
        return (
          <div key={group.key}>
            {group.section && (
              <button
                onClick={() => onToggle(group.key)}
                className="w-full flex items-center justify-between mt-4 mb-1 px-3 py-0.5 group"
              >
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider group-hover:text-gray-400 transition-colors">
                  {group.section}
                </span>
                <CollapseIcon open={isOpen} />
              </button>
            )}
            {isOpen && group.items.map(item => (
              <Link
                key={item.href}
                href={base + item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors',
                  isActive(pathname, item, base)
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800',
                )}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        )
      })}
    </>
  )
}

const STORAGE_KEY = 'paxis_sidebar_collapsed'

export default function Sidebar({ companyName = 'PAXIS', orgSlug = '' }: { companyName?: string; orgSlug?: string }) {
  const pathname = usePathname()
  const router   = useRouter()
  const base     = orgSlug ? `/${orgSlug}` : ''
  const { data: session } = useSession()

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  // 從 localStorage 讀取折疊狀態
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setCollapsed(JSON.parse(saved))
    } catch {}
  }, [])

  // 點外部關閉設定 popover
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    if (settingsOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [settingsOpen])

  function toggleSection(key: string) {
    setCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  return (
    <aside className="w-52 bg-gray-900 text-white flex flex-col">

      {/* ── Logo ── */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-700 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">PAXIS</h1>
          <p className="text-xs text-gray-400 truncate max-w-[140px]">{companyName}</p>
        </div>
        <NotificationBell />
      </div>

      {/* ── 主導覽 ── */}
      <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5 overflow-y-auto">
        <NavLinks
          groups={b2bGroups}
          pathname={pathname}
          base={base}
          collapsed={collapsed}
          onToggle={toggleSection}
        />
      </nav>

      {/* ── 底部：設定 + 登出 ── */}
      <div className="px-2 py-3 border-t border-gray-700 space-y-1" ref={settingsRef}>

        {/* 設定 popover */}
        <div className="relative">
          <button
            onClick={() => setSettingsOpen(v => !v)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors',
              settingsOpen ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800',
            )}
          >
            <span className="text-base leading-none">⚙️</span>
            <span>設定</span>
            <CollapseIcon open={settingsOpen} />
          </button>

          {settingsOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden">
              {settingsItems.map(item => (
                <Link
                  key={item.href}
                  href={item.absolute ? item.href : base + item.href}
                  onClick={() => setSettingsOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 text-sm transition-colors',
                    isActive(pathname, item, base)
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700',
                  )}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 使用者 + 登出 */}
        {session?.user && (
          <p className="text-[11px] text-gray-600 truncate px-3">{session.user.email}</p>
        )}
        <button
          onClick={() => signOut({ callbackUrl: base + '/login' })}
          className="w-full flex items-center gap-3 px-3 py-1.5 rounded-md text-sm text-gray-400 hover:bg-gray-800 transition-colors"
        >
          <span className="text-base leading-none">🚪</span>
          <span>登出</span>
        </button>
      </div>
    </aside>
  )
}
