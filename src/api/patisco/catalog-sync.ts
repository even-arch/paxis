/**
 * Patisco 商品型錄同步
 *
 * getBuyers / getBuyerCatalogs / getBuyerCategories / getBuyerCategoryProducts
 * 等 API 已在新版 Patisco MCP 中移除，型錄同步暫時停用。
 * 商品資料改從訂單明細（getOrderProducts）同步。
 */

export type CatalogSyncResult = {
  buyers: number
  catalogs: number
  categories: number
  products: number
  created: number
  updated: number
  skipped: number
  errors: number
  details: Array<{
    sku: string
    action: 'created' | 'updated' | 'skipped' | 'error'
    msg?: string
  }>
}

export async function syncPatiscoCatalog(): Promise<CatalogSyncResult> {
  console.warn('[catalog-sync] 型錄同步 API 已移除，跳過')
  return {
    buyers: 0, catalogs: 0, categories: 0, products: 0,
    created: 0, updated: 0, skipped: 0, errors: 0, details: [],
  }
}
