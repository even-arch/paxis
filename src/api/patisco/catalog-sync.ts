import type { PrismaClient } from '@prisma/client'
/**
 * Patisco 商品型錄同步
 *
 * 流程：
 *   1. 取得所有 Buyer（有 CatlogID 的才有型錄）
 *   2. 逐 Buyer 取分類樹（getBuyerCategories）
 *   3. 逐葉節點取商品摘要列表（getBuyerCategoryProducts）
 *   4. 逐商品取完整資料（getBuyerProductDetail）
 *   5. Upsert 到 PRD_Product（以 SKU 為 key，無 SKU 用 patiscoProductId）
 *
 * 同步策略：
 *   - 有 SKU → 以 SKU 為唯一鍵 upsert（符合 PAXIS SKU = 唯一識別碼原則）
 *   - 無 SKU → 以 patiscoProductId 為 fallback（型錄 ProductID）
 *   - 不自動刪除 PAXIS 商品（Patisco 下架不等於 PAXIS 刪除）
 *   - 尺寸/重量優先用 Patisco 值填充空白，不覆蓋已手動填寫的非空值
 *   - GW/NW/尺寸是昂貴欄位，只在 detail 同步時更新
 */

import { prisma } from '@/lib/db'
import {
  patiscoLogin,
  getBuyers,
  getBuyerCatalogs,
  getBuyerCategories,
  getBuyerCategoryProducts,
  getBuyerProductDetail,
  type PatiscoBuyer,
  type PatiscoBuyerCategory,
  type PatiscoBuyerCatalogProduct,
  type PatiscoProductDetail,
} from './client'

export type CatalogSyncResult = {
  buyers: number
  catalogs: number
  categories: number
  products: number        // 看到幾個商品
  created: number
  updated: number
  skipped: number         // 無 SKU 且無 patiscoProductId
  errors: number
  details: Array<{
    sku: string
    action: 'created' | 'updated' | 'skipped' | 'error'
    msg?: string
  }>
}

// ─── 主要入口 ─────────────────────────────────────────────────────────────────

export async function syncPatiscoCatalog(): Promise<CatalogSyncResult> {
    const result: CatalogSyncResult = {
    buyers: 0, catalogs: 0, categories: 0, products: 0,
    created: 0, updated: 0, skipped: 0, errors: 0, details: [],
  }

  const creds = await patiscoLogin(prisma)
  if (!creds) {
    console.warn('[catalog-sync] 未設定 PATISCO 帳密，跳過')
    return result
  }

  // 1. 取所有 buyer（有 CatlogID 才有型錄）
  const buyersRes = await getBuyers(creds, { first: 200, offset: 0 })
  if (!buyersRes.ok) {
    console.error('[catalog-sync] getBuyers 失敗', buyersRes.error)
    return result
  }

  const buyers: PatiscoBuyer[] = (buyersRes.data?.items ?? []).filter(b => !!b.CatlogID)
  result.buyers = buyers.length

  // 2. 逐 Buyer 同步
  for (const buyer of buyers) {
    const buyerId = buyer.ID
    const catalogId = buyer.CatlogID
    if (!catalogId) continue

    result.catalogs++

    // 取分類樹
    const catsRes = await getBuyerCategories(creds, buyerId, catalogId)
    if (!catsRes.ok) {
      console.warn(`[catalog-sync] getBuyerCategories 失敗 buyer=${buyerId}`, catsRes.error)
      continue
    }

    // 展開所有葉節點（children 為空的 category，或直接有 children 清單的情況）
    const allCategories: PatiscoBuyerCategory[] = catsRes.data?.items ?? []
    const leafIds = collectLeafIds(allCategories)
    result.categories += leafIds.length

    // 用 Set 避免同一商品從多個分類重複同步
    const seenProductIds = new Set<string>()

    // 3. 逐葉節點取商品列表
    for (const categoryId of leafIds) {
      let offset = 0
      const pageSize = 20

      while (true) {
        const prodsRes = await getBuyerCategoryProducts(creds, {
          buyerId,
          catalogId,
          categoryId,
          first: pageSize,
          offset,
        })

        if (!prodsRes.ok) {
          console.warn(`[catalog-sync] getBuyerCategoryProducts 失敗 cat=${categoryId}`, prodsRes.error)
          break
        }

        const products: PatiscoBuyerCatalogProduct[] = prodsRes.data?.items ?? []
        if (products.length === 0) break

        // 4. 逐商品取完整資料並 upsert
        for (const prod of products) {
          if (seenProductIds.has(prod.id)) continue
          seenProductIds.add(prod.id)
          result.products++

          const detailRes = await getBuyerProductDetail(creds, {
            buyerId,
            catalogId,
            productId: prod.id,
          })

          const detail = detailRes.ok ? detailRes.data?.item : undefined
          const item = detail ?? { id: prod.id, sku: prod.sku, modelNo: prod.modelNo, name: prod.name }

          const actionResult = await upsertProduct(prisma, item, buyer.Name)
          result[actionResult.action === 'created' ? 'created'
            : actionResult.action === 'updated' ? 'updated'
            : actionResult.action === 'skipped' ? 'skipped'
            : 'errors']++
          if (result.details.length < 200) {
            result.details.push(actionResult)
          }
        }

        // 分頁
        const total = prodsRes.data?.totalCount ?? 0
        offset += pageSize
        if (offset >= (typeof total === 'number' ? total : parseInt(String(total), 10) || 0)) break
        if (products.length < pageSize) break
      }
    }
  }

  console.log(
    `[catalog-sync] 完成 buyers=${result.buyers} products=${result.products} ` +
    `created=${result.created} updated=${result.updated} errors=${result.errors}`
  )
  return result
}

// ─── 收集葉節點 CategoryID ────────────────────────────────────────────────────

function collectLeafIds(categories: PatiscoBuyerCategory[]): string[] {
  const leafIds: string[] = []

  function walk(cats: PatiscoBuyerCategory[]) {
    for (const cat of cats) {
      if (cat.children && cat.children.length > 0) {
        walk(cat.children)
      } else {
        leafIds.push(cat.id)
      }
    }
  }

  walk(categories)

  // 若所有分類都沒有 children（flat 結構），直接用全部
  if (leafIds.length === 0) {
    return categories.map(c => c.id)
  }

  return leafIds
}

// ─── Upsert 單一商品 ──────────────────────────────────────────────────────────

async function upsertProduct(
  prisma: PrismaClient,
  item: Partial<PatiscoProductDetail> & { id: string },
  buyerName: string,
): Promise<{ sku: string; action: 'created' | 'updated' | 'skipped' | 'error'; msg?: string }> {
  const sku = item.sku?.trim() || null
  const patiscoProductId = item.id
  const label = sku ?? patiscoProductId

  if (!sku && !patiscoProductId) {
    return { sku: '(unknown)', action: 'skipped', msg: '無 SKU 且無 patiscoProductId' }
  }

  try {
    // 找現有商品
    const existing = await prisma.pRD_Product.findFirst({
      where: {
        isActive: true,
        OR: [
          ...(sku ? [{ sku }] : []),
          { patiscoProductId },
        ],
      },
    })

    // 解析重量/尺寸（Patisco 全是 string）
    const netWeight = item.netWeight ? parseFloat(item.netWeight) : null
    const grossWeight = item.grossWeight ? parseFloat(item.grossWeight) : null
    const length = item.length ? parseFloat(item.length) : null
    const width = item.width ? parseFloat(item.width) : null
    const height = item.height ? parseFloat(item.height) : null
    const cbm = item.totalDimension ? parseFloat(item.totalDimension) : null
    const unitPerCarton = item.unitPerCarton ? parseInt(item.unitPerCarton, 10) : null
    const placeOfOrigin = item.placeOfOrigin ?? null

    if (!existing) {
      // 建立新商品
      const product = await prisma.pRD_Product.create({
        data: {
          name: item.name || item.modelNo || sku || patiscoProductId,
          sku,
          modelNo: item.modelNo || null,
          specification: item.specification || null,
          unit: item.unit || null,
          netWeight: netWeight !== null ? String(netWeight) : null,
          grossWeight: grossWeight !== null ? String(grossWeight) : null,
          length: length !== null ? String(length) : null,
          width: width !== null ? String(width) : null,
          height: height !== null ? String(height) : null,
          cbm: cbm !== null ? String(cbm) : null,
          unitPerCarton,
          countryOfOrigin: placeOfOrigin,
          patiscoProductId,
          isActive: true,
        },
      })
      // 初始化庫存
      await prisma.iNV_Stock.upsert({
        where: { productId: product.id },
        create: { productId: product.id, quantity: 0, reservedQty: 0, safetyStock: 0 },
        update: {},
      })
      return { sku: label, action: 'created' }
    }

    // 更新現有商品：只填空白欄位（不覆蓋手動填的值）
    // 必更新：patiscoProductId（建立關聯）、name（如果來自 Patisco 且我方沒改過）
    const updateData: Record<string, unknown> = {
      patiscoProductId,
    }

    // 只有欄位為空才填入 Patisco 資料
    if (!existing.netWeight && netWeight !== null) updateData.netWeight = String(netWeight)
    if (!existing.grossWeight && grossWeight !== null) updateData.grossWeight = String(grossWeight)
    if (!existing.length && length !== null) updateData.length = String(length)
    if (!existing.width && width !== null) updateData.width = String(width)
    if (!existing.height && height !== null) updateData.height = String(height)
    if (!existing.cbm && cbm !== null) updateData.cbm = String(cbm)
    if (!existing.unitPerCarton && unitPerCarton !== null) updateData.unitPerCarton = unitPerCarton
    if (!existing.unit && item.unit) updateData.unit = item.unit
    if (!existing.modelNo && item.modelNo) updateData.modelNo = item.modelNo
    if (!existing.specification && item.specification) updateData.specification = item.specification
    if (!existing.countryOfOrigin && placeOfOrigin) updateData.countryOfOrigin = placeOfOrigin

    await prisma.pRD_Product.update({
      where: { id: existing.id },
      data: updateData,
    })

    return { sku: label, action: 'updated' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[catalog-sync] upsert 失敗 sku=${label}`, err)
    return { sku: label, action: 'error', msg }
  }
}
