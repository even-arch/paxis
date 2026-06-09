export default function MarketplaceDashboard() {
  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">電商總覽</h1>
        <p className="text-sm text-gray-500 mt-1">管理 Shopee 等電商平台的訂單與出貨</p>
      </div>

      {/* 統計卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: '待出貨',   value: '–', color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: '今日截止', value: '–', color: 'text-red-600',    bg: 'bg-red-50'    },
          { label: '本月訂單', value: '–', color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: '本月出貨', value: '–', color: 'text-green-600',  bg: 'bg-green-50'  },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-xl p-5`}>
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* 尚未設定提示 */}
      <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
        <div className="text-5xl mb-4">🛍️</div>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">尚未連結電商平台</h2>
        <p className="text-sm text-gray-400 mb-6">
          請先前往「API 憑證」設定 Shopee 的 Shop ID 與存取金鑰，<br/>
          完成後即可開始同步訂單。
        </p>
        <a
          href="/marketplace/settings/api"
          className="inline-flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          🔑 前往設定 API 憑證
        </a>
      </div>
    </div>
  )
}
