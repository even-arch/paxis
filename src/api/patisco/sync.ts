/**
 * Patisco → PAXIS 同步核心邏輯
 * 被 Webhook 和 Cron 兩條路共用
 *
 * 流程：
 *   1. 取得已確認的 Patisco PI 列表
 *   2. 逐張 PI 確認是否已處理（SYS_PatiscoSync 去重）
 *   3. 未處理者：拉明細 → 找對應 PAXIS 商品 → 扣庫存 → 寫 INV_Movement
 *   4. 記錄同步結果到 SYS_PatiscoSync
 */

import { prisma } from '@/lib/db'
import {
  patiscoLogin,
  getPIs,
  getOrderProducts,
  type PatiscoPI,
  type PatiscoPIProduct,
} from './client'

export type SyncSource = 'webhook' | 'cron'

export type SyncResult = {
  total: number        // 這次看到幾張 PI
  skipped: number      // 已處理過的
  processed: number    // 這次新處理的
  errors: number
  details: Array<{
    patiscoDocNo: string
    status: 'ok' | 'partial' | 'skipped' | 'error'
    msg?: string
    items?: Array<{ sku: string; qty: number; stockAfter: number }>
  }>
}

// ─── 主要入口 ─────────────────────────────────────────────────────────────────

export async function syncPatiscoPIs(source: SyncSource): Promise<SyncResult> {
  const result: SyncResult = { total: 0, skipped: 0, processed: 0, errors: 0, details: [] }

  // 1. 認證
  const creds = await patiscoLogin()
  if (!creds) {
    console.warn('[patisco-sync] 未設定 PATISCO 帳密，跳過')
    return result
  }

  // 2. 拉取已確認的 PI（Status=3, Type=2）
  const piRes = await getPIs(creds, {
    filter: { Status: '3', Type: '2' },
    first: 0,
    offset: 50,
    orderBy: 'CreatedDate_DESC',
  })

  if (!piRes.ok) {
    console.error('[patisco-sync] getPIs 失敗', piRes.error)
    return result
  }

  const pis: PatiscoPI[] = piRes.data?.items ?? []
  result.total = pis.length

  // 3. 逐張處理
  for (const pi of pis) {
    const docId = Number(pi.ID)
    const docNo = pi.No

    // 去重：已處理過就跳過
    const existing = await prisma.sYS_PatiscoSync.findUnique({
      where: { patiscoDocId: docId },
    })
    if (existing) {
      result.skipped++
      continue
    }

    // 拉明細
    const prodRes = await getOrderProducts(creds, docId)
    if (!prodRes.ok) {
      await recordSync(docId, docNo, source, 'error', null, `getOrderProducts 失敗: ${prodRes.error}`)
      result.errors++
      result.details.push({ patiscoDocNo: docNo, status: 'error', msg: prodRes.error })
      continue
    }

    const products: PatiscoPIProduct[] = prodRes.data?.items ?? pi.Products ?? []

    // 處理每個明細
    const itemResults: SyncResult['details'][0]['items'] = []
    let hasError = false

    for (const item of products) {
      const processResult = await processInventoryDeduction(item, docId, docNo)
      if (processResult) {
        itemResults.push(processResult)
      } else {
        hasError = true
      }
    }

    const status = hasError && itemResults.length === 0 ? 'error'
      : hasError ? 'partial'
      : products.length === 0 ? 'skipped'
      : 'ok'

    await recordSync(docId, docNo, source, status, itemResults, hasError ? '部分商品找不到對應' : null)

    result.processed++
    result.details.push({ patiscoDocNo: docNo, status, items: itemResults })
  }

  return result
}

// ─── 庫存扣減 ─────────────────────────────────────────────────────────────────

async function processInventoryDeduction(
  item: PatiscoPIProduct,
  patiscoDocId: number,
  patiscoDocNo: string,
) {
  // 找對應的 PAXIS 商品（用 patiscoProductId 或 SKU）
  const product = await prisma.pRD_Product.findFirst({
    where: {
      isActive: true,
      OR: [
        { patiscoProductId: Number(item.ProductID) },
        ...(item.SKU ? [{ sku: item.SKU }] : []),
      ],
    },
  })

  if (!product) {
    console.warn(`[patisco-sync] 找不到商品 ProductID=${item.ProductID} SKU=${item.SKU}`)
    return null
  }

  const qty = item.Quantity

  // 扣庫存（type=4 出倉）
  const stock = await prisma.iNV_Stock.upsert({
    where: { productId: product.id },
    create: { productId: product.id, quantity: 0, reservedQty: 0, safetyStock: 0 },
    update: { quantity: { decrement: qty } },
  })

  // 確保不低於 0
  const stockAfter = Math.max(0, stock.quantity)
  if (stock.quantity < 0) {
    await prisma.iNV_Stock.update({ where: { productId: product.id }, data: { quantity: 0 } })
  }

  // 寫異動紀錄
  await prisma.iNV_Movement.create({
    data: {
      productId: product.id,
      type: 4, // 出倉
      qtyDelta: -qty,
      reservedDelta: 0,
      quantityAfter: stockAfter,
      reservedAfter: stock.reservedQty,
      patiscoDocType: 'PI_CONFIRMED',
      patiscoDocId,
      patiscoDocNo,
      note: `Patisco PI 確認出倉：${patiscoDocNo}`,
    },
  })

  return { sku: item.SKU ?? String(item.ProductID), qty, stockAfter }
}

// ─── 寫同步紀錄 ───────────────────────────────────────────────────────────────

async function recordSync(
  patiscoDocId: number,
  patiscoDocNo: string,
  source: SyncSource,
  status: string,
  result: unknown,
  errorMsg: string | null,
) {
  try {
    await prisma.sYS_PatiscoSync.create({
      data: {
        patiscoDocId,
        patiscoDocNo,
        source,
        status,
        result: result as object ?? {},
        errorMsg,
      },
    })
  } catch (err) {
    // upsert fallback（重複鍵）
    console.warn('[patisco-sync] recordSync 寫入失敗', err)
  }
}
