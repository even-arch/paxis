import Link from 'next/link'

export default function AdminSettingsPage({ params }: { params: { orgSlug: string } }) {
  const base = `/${params.orgSlug}/admin/settings`
  const SETTINGS = [
    {
      href: `${base}/ups`,
      icon: '📦',
      title: 'UPS 帳號',
      desc: '錫諾系統自有 UPS Account Number，無需 redeploy 即可更換',
    },
    {
      href: `${base}/general`,
      icon: '⚙️',
      title: '一般設定',
      desc: 'Feature flags 設定',
    },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/${params.orgSlug}/admin`} className="text-sm text-gray-400 hover:text-gray-600">← 管理後台</Link>
        <h2 className="font-semibold text-gray-800">系統設定</h2>
      </div>
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

