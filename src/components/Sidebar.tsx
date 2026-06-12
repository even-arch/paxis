'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type NavItem  = { label: string; href: string; icon: string; exact?: boolean }
type NavGroup = { section: string; items: NavItem[] }

// ── B2B 導覽（貿易 / Patisco 整合）────────────────────────────────
const b2bGroups: NavGroup[] = [
  {
    section: '',
    items: [
      { label: '總覽', href: '/dashboard', icon: '📊', exact: true },
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
      { label: '對帳 / 付款',   href: '/finance', icon: '💳' },
      { label: '到岸成本試算',  href: '/cost',    icon: '🧮' },
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
  { label: '個人設定',   href: '/settings/profile',   icon: '👤' },
  { label: '管理後台',   href: '/admin',              icon: '⚙️' },
]

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href
  if (pathname === item.href) return true
  if (item.href === '/sales') {
    return pathname.startsWith('/sales/')
  }
  return pathname.startsWith(item.href + '/')
}

function NavLinks({ groups, pathname }: { groups: NavGroup[]; pathname: string }) {
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
    </>
  )
}

type Mode = 'b2b' | 'b2c'

export default function Sidebar({ companyName = 'PAXIS' }: { companyName?: string }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const { data: session } = useSession()

  // 根據目前路徑自動判斷模式；否則從 localStorage 讀取；預設 b2b
  const detectMode = (): Mode => {
    if (pathname.startsWith('/marketplace')) return 'b2c'
    return 'b2b'
  }

  const [mode, setMode] = useState<Mode>('b2b')

  // 初始化：路徑優先，其次 localStorage
  useEffect(() => {
    if (pathname.startsWith('/marketplace')) {
      setMode('b2c')
    } else {
      const saved = localStorage.getItem('paxis_mode') as Mode | null
      if (saved === 'b2c' && !pathname.startsWith('/marketplace')) {
        setMode('b2b')   // 若不在 /marketplace 路徑，還是顯示 b2b sidebar
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 路徑變化時同步模式
  useEffect(() => {
    if (pathname.startsWith('/marketplace')) {
      setMode('b2c')
    }
  }, [pathname])

  function switchMode(next: Mode) {
    setMode(next)
    localStorage.setItem('paxis_mode', next)
    if (next === 'b2c') router.push('/marketplace')
    else                router.push('/dashboard')
  }

  const isB2B = mode === 'b2b'

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col">

      {/* ── 頂部 Logo ── */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-700">
        <h1 className="text-lg font-bold">PAXIS</h1>
        <p className="text-xs text-gray-400">{companyName}</p>
      </div>

      {/* ── 模式切換器 ── */}
      <div className="px-3 py-3 border-b border-gray-700">
        <div className="flex rounded-lg bg-gray-800 p-0.5 text-xs font-medium">
          <button
            onClick={() => switchMode('b2b')}
            className={cn(
              'flex-1 py-1.5 rounded-md transition-colors text-center leading-tight',
              isB2B
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-400 hover:text-gray-200',
            )}
          >
            🏭 B2B<br/>
            <span className="text-[10px] font-normal opacity-75">貿易</span>
          </button>
          <button
            onClick={() => switchMode('b2c')}
            className={cn(
              'flex-1 py-1.5 rounded-md transition-colors text-center leading-tight',
              !isB2B
                ? 'bg-orange-500 text-white shadow'
                : 'text-gray-400 hover:text-gray-200',
            )}
          >
            🛍️ B2C<br/>
            <span className="text-[10px] font-normal opacity-75">電商</span>
          </button>
        </div>
      </div>

      {/* ── 導覽項目（依模式切換）── */}
      <nav className="flex-1 py-4 px-2 flex flex-col gap-0.5 overflow-y-auto">
        {isB2B ? (
          <>
            <NavLinks groups={b2bGroups} pathname={pathname} />
            {/* B2B 模式才顯示系統設定 */}
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
          </>
        ) : (
          <NavLinks groups={b2cGroups} pathname={pathname} />
        )}
      </nav>

      {/* ── 底部登出 ── */}
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
