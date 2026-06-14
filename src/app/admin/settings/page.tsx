export const dynamic = 'force-dynamic'
import Link from 'next/link'

const SETTINGS = [
  {
    href: '/admin/settings/payuni',
    icon: '💳',
    title: 'PayUni 金鑰',
    desc: '管理付款金鑰（MerID / MerKey / MerIV），無需 redeploy 即可更換',
  },
  {
    href: '/admin/settings/ups',
    icon: '📦',
    title: 'UPS 帳號',
    desc: '錫諾系統自有 UPS Account Number，managed 模式租戶共用，無需 redeploy 即可更換',
  },
  {
    href: '/admin/settings/general',
    icon: '⚙️',
    title: '一般設定',
    desc: 'Feature flags，例如刪除租戶按鈕開關',
  },
]

export default function AdminSettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="font-semibold text-gray-800">系統設定</h2>
      <div className="grid gap-3">
        {SETTINGS.map(s => (
          <Link key={s.href} href={s.href}
            className="bg-white rounded-lg border p-5 hover:border-blue-400 hover:shadow-sm transition-all flex items-start gap-4">
            <span className="text-2xl">{s.icon}</span>
            <div>
              <p className="font-medium text-gray-800 text-sm">{s.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
            </div>
            <span className="text-gray-300 ml-auto self-center">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
