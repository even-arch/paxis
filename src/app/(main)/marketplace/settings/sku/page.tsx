export default function SkuMappingPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">SKU 對照表</h1>
        <p className="text-sm text-gray-500 mt-1">將 Shopee 上架商品的 Model ID 對應到 PAXIS 內部 SKU</p>
      </div>

      <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
        <div className="text-5xl mb-4">🔗</div>
        <p className="text-gray-400 text-sm">請先完成 API 憑證設定，才能載入 Shopee 商品清單。</p>
        <a href="/marketplace/settings/api" className="text-orange-500 hover:underline text-sm mt-2 inline-block">
          前往設定 API →
        </a>
      </div>
    </div>
  )
}
