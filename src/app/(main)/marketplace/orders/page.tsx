export default function MarketplaceOrdersPage() {
  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Shopee 訂單</h1>
          <p className="text-sm text-gray-500 mt-1">從 Shopee 同步的訂單列表</p>
        </div>
        <button
          disabled
          className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium opacity-50 cursor-not-allowed"
        >
          🔄 立即同步
        </button>
      </div>

      <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
        <div className="text-5xl mb-4">📭</div>
        <p className="text-gray-400 text-sm">尚未設定 Shopee API 憑證，無法同步訂單。</p>
        <a href="/marketplace/settings/api" className="text-orange-500 hover:underline text-sm mt-2 inline-block">
          前往設定 →
        </a>
      </div>
    </div>
  )
}
