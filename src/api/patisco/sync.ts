/**
 * Patisco → PAXIS 同步核心邏輯
 * 被 Webhook 和 Cron 兩條路共用
 *
 * 文件分類邏輯（以「主位 / 副位」判別正副本）
 *
 * 主位 = 這張單子的發起方（文件最高位置的公司名）
 * 副位 = 接收方（文件次位）
 *
 * 規則：主位是我方 → 正本（我方發出）；主位是對方 → 副本（我方收到）
 *
 * PI 文件（主位 = Seller，買賣雙方中的發單方）：
 *   主位 = 我方, 副位 = 客戶  → 我方 PI 正本 → reservedQty++，建 SLS_Order + SLS_PI
 *   主位 = 我方, 副位 = 供應商 → 我方 PO 正本 → 跳過（由 PAXIS 主動建立）
 *   主位 = 供應商, 副位 = 我方  → 供應商 PI 副本 → 建 PO_SupplierPI（入倉由人工確認）
 *   主位 = 客戶,   副位 = 我方  → 客戶 PO 副本 → 建 SLS_Order（不動庫存）
 *
 * 注意：PI 文件中主位對應 pi.seller 欄位；若未來加入 PO 文件類型，主位改看 pi.buyer。
 * 供應商出貨文件：不透過 Patisco 傳遞，syncPatiscoShipments 已移除。
 */

import { prisma as defaultPrisma } from '@/lib/db'
import { neon } from '@neondatabase/serverless'
import { Decimal } from '@prisma/client/runtime/library'
import type { PrismaClient } from '@prisma/client'
import {
  patiscoLogin,
  getPIs,
  getOrderProducts,
  getOrderDetail,
  getBuyers,
  getSellers,
  listOrderCopies,
  getOrderCopyDetail,
  getOrderCopyProducts,
  resolvePatiscoCurrency,
  type PatiscoCredentials,
  type PatiscoPI,
  type PatiscoPIProduct,
  type PatiscoOrderDetailItem,
  type PatiscoBuyer,
  type PatiscoSeller,
  type PatiscoOrderWithProducts,
  type PatiscoExtraCharge,
  type PatiscoOrderCopyProduct,
} from './client'
import { enrichProduct } from './product-enrich'

export type SyncSource = 'webhook' | 'cron' | 'manual'

export type SyncResult = {
  total: number
  skipped: number
  processed: number
  errors: number
  details: Array<{
    patiscoDocNo: string
    status: 'ok' | 'partial' | 'skipped' | 'error'
    msg?: string
    items?: Array<{ sku: string; qty: number; reservedAfter: number }>
  }>
}

export type BuyerSyncResult = {
  total: number
  created: number
  updated: number
  skipped: number
  errors: number
}

// ─── 主要入口 ─────────────────────────────────────────────────────────────────
//
// prisma 由呼叫方（route handler）傳入，避免在深層 async 鏈裡 getServerSession 失效
// 若未傳入則退回 getTenantDb()（cron 等無 session 情境用）

// neon() 的 tagged template 會把所有參數送成 integer OID，導致 text 欄位查詢失敗。
// 解法：把值直接嵌入 SQL 字串，用 zero-interpolation 送出（無參數化，無型別推斷）。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function execSQL(sql: any, query: string): Promise<Record<string, unknown>[]> {
  const tmpl = Object.assign([query], { raw: [query] }) as unknown as TemplateStringsArray
  return (sql as unknown as (t: TemplateStringsArray) => Promise<Record<string, unknown>[]>)(tmpl)
}

function esc(v: string) { return v.replace(/'/g, "''") }

export async function syncPatiscoPIs(source: SyncSource, db?: PrismaClient, dbUrl?: string, sharedCreds?: PatiscoCredentials & { _mcpUrl: string }): Promise<SyncResult> {
  const prisma = db ?? defaultPrisma
  const resolvedDbUrl = dbUrl ?? process.env.DATABASE_URL!
  const sql = neon(resolvedDbUrl)
  const result: SyncResult = { total: 0, skipped: 0, processed: 0, errors: 0, details: [] }

  // 1. 認證（優先用外部傳入的 sharedCreds，避免多次 login 互蓋 session）
  const creds = sharedCreds ?? await patiscoLogin(prisma)
  if (!creds) {
    console.warn('[patisco-sync] 未設定 PATISCO 帳密，跳過')
    return result
  }

  // 2. 讀我方公司名稱（用於識別正本/副本）
  // Fallback：若 SYS_Company 尚未填寫（如剛 reset），從 Patisco 帳號 email domain 推斷
  const company = await prisma.sYS_Company.findFirst()
  const patiscoConfig = await prisma.sYS_PatiscoConfig.findFirst({ where: { isActive: true } })
  const emailDomain = patiscoConfig?.username?.split('@')[1]?.split('.')[0]?.toLowerCase() // e.g. "pointasia"

  const ourNameVariants = [
    company?.nameEn,
    company?.shortName,
    company?.nameZh,
    emailDomain,
  ].filter(Boolean).map(n => n!.trim().toLowerCase())

  // 讀取已確認的公司別名（SELF / CUSTOMER / SUPPLIER）
  const allAliases = await prisma.sYS_CompanyAlias.findMany({
    select: { alias: true, role: true, customerId: true, supplierId: true },
  })
  const aliasMap = new Map(allAliases.map(a => [a.alias.trim().toLowerCase(), a]))

  // 判斷是否為我方公司（含已學習的別名）
  const isOurCompany = (name: string): boolean => {
    if (!name) return false
    const low = name.trim().toLowerCase()
    // 先查別名表
    const aliasEntry = aliasMap.get(low)
    if (aliasEntry?.role === 'SELF') return true
    // 再比對 SYS_Company 名稱變體
    if (ourNameVariants.length === 0) return false
    return ourNameVariants.some(v => v.length >= 4 && (low.includes(v) || v.includes(low)))
  }

  // 3. 讀客戶與供應商清單（用於比對買賣方）
  const customers = await prisma.cUS_Customer.findMany({
    where: { isActive: true },
    select: { id: true, name: true, patiscoBuyerId: true },
  })
  const suppliers = await prisma.sUP_Supplier.findMany({
    where: { isActive: true },
    select: { id: true, name: true, patiscoSupplierId: true },
  })

  // 系統用戶 ID（Patisco 自動同步使用 isSystem=true 的帳號）
  const systemUser = await prisma.sYS_User.findFirst({ where: { isSystem: true } })
  const systemUserId = systemUser?.id ?? 1

  // 4. 拉取所有 PI（含 Editing，測試期先全拉；Status 不傳 = 不過濾）
  const piRes = await getPIs(creds, {
    first: 50,
    orderBy: 'CreatedDate_DESC',
  })

  if (!piRes.ok) {
    console.error('[patisco-sync] getPIs 失敗', piRes.error)
    return result
  }

  const pis: PatiscoPI[] = piRes.data?.items ?? []
  result.total = pis.length

  // 5. 逐張處理
  for (const pi of pis) {
    const docId = pi.no
    const docNo = pi.no
    const sellerName = pi.seller ?? ''
    const buyerName  = pi.buyer  ?? ''

    // 去重：成功 / 部分成功 → 跳過；失敗 → 刪舊紀錄重試
    const syncRows = await execSQL(sql,
      `SELECT id, status FROM "SYS_PatiscoSync" WHERE "docType" = 'PI' AND "patiscoDocId" = '${esc(docId)}' LIMIT 1`
    )
    const existing = (syncRows[0] as { id: number; status: string } | undefined) ?? null
    if (existing?.status === 'ok' || existing?.status === 'partial') {
      result.skipped++
      continue
    }
    if (existing?.status === 'error') {
      await prisma.sYS_PatiscoSync.deleteMany({ where: { id: existing.id } })
    }

    try {
      if (isOurCompany(sellerName)) {
        // ── 主位 = 我方公司（正本，我方發出）→ 正PI ────────────────────────
        const customer = matchCustomerWithAlias(buyerName, customers, aliasMap)

        if (customer === 'UNKNOWN') {
          // 找不到 → 停下來等使用者確認，不自動建立
          await recordSync(sql, 'PI', docId, docNo, source, 'needs_confirm',
            { unknownCompanies: [{ name: buyerName, roleHint: 'CUSTOMER', docType: '正PI' }] }, null)
          result.skipped++
          result.details.push({ patiscoDocNo: docNo, status: 'skipped',
            msg: `買方「${buyerName}」尚未建檔，請至 Patisco 設定頁確認公司角色後重試` })
        } else if (!customer) {
          await recordSync(sql, 'PI', docId, docNo, source, 'skipped', null, `Buyer 名稱為空`)
          result.skipped++
          result.details.push({ patiscoDocNo: docNo, status: 'skipped', msg: 'Buyer 名稱為空' })
        } else {
          // 副位 = 客戶 → 我方 PI 正本
          const r = await processOurPIToCustomer(prisma, creds, pi, customer.id, systemUserId, source)
          const status = r.ok ? (r.partial ? 'partial' : 'ok') : 'error'
          await recordSync(sql, 'PI', docId, docNo, source, status, r.items ?? null, r.error ?? null)
          result.details.push({ patiscoDocNo: docNo, status, items: r.items, msg: r.error })
          r.ok ? result.processed++ : result.errors++
        }
      } else {
        // ── 主位 ≠ 我方公司（副本，我方收到）→ 副PI ─────────────────────────
        const supplier = matchSupplierWithAlias(sellerName, suppliers, aliasMap)

        if (supplier === 'UNKNOWN') {
          // 找不到 → 停下來等使用者確認
          await recordSync(sql, 'PI', docId, docNo, source, 'needs_confirm',
            { unknownCompanies: [{ name: sellerName, roleHint: 'SUPPLIER', docType: '副PI' }] }, null)
          result.skipped++
          result.details.push({ patiscoDocNo: docNo, status: 'skipped',
            msg: `賣方「${sellerName}」尚未建檔，請至 Patisco 設定頁確認公司角色後重試` })
        } else if (!supplier) {
          await recordSync(sql, 'PI', docId, docNo, source, 'skipped', null, `Seller 名稱為空`)
          result.skipped++
          result.details.push({ patiscoDocNo: docNo, status: 'skipped', msg: 'Seller 名稱為空' })
        } else {
          // 主位 = 供應商 → 供應商 PI 副本：建 PO_SupplierPI（入倉由人工確認）
          const r = await processSupplierPI(prisma, creds, pi, supplier.id, systemUserId, source)
          const status = r.ok ? 'ok' : 'error'
          await recordSync(sql, 'PI', docId, docNo, source, status, null, r.error ?? null)
          result.details.push({ patiscoDocNo: docNo, status, msg: r.error ?? `供應商 PI 副本已記錄，請至採購頁確認入倉` })
          r.ok ? result.processed++ : result.errors++
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[patisco-sync] 處理 PI ${docNo} 失敗`, err)
      await recordSync(sql, 'PI', docId, docNo, source, 'error', null, msg)
      result.errors++
      result.details.push({ patiscoDocNo: docNo, status: 'error', msg })
    }
  }

  return result
}

// ─── 我方 PI 正本 → 客戶：reservedQty++，建 SLS_Order + SLS_PI ──────────────

async function processOurPIToCustomer(
  prisma: PrismaClient,
  creds: Awaited<ReturnType<typeof patiscoLogin>>,
  pi: PatiscoPI,
  customerId: number,
  systemUserId: number,
  source: SyncSource,
): Promise<{
  ok: boolean
  partial?: boolean
  error?: string
  items?: Array<{ sku: string; qty: number; reservedAfter: number }>
}> {
  if (!creds) return { ok: false, error: 'auth failed' }

  const piId = pi.no

  // 拉取 PI 完整 header（含 extraCharges、payment/Incoterm）
  const detailRes = await getOrderDetail(creds, pi.id)
  const orderDetail = detailRes.ok ? (detailRes.data?.order ?? null) : null
  const tradeTermsCode = orderDetail?.payment != null ? parseInt(String(orderDetail.payment), 10) : null
  const extraCharges: PatiscoExtraCharge[] = orderDetail?.extraCharges ?? []

  // 拉取 PI 商品明細
  const prodRes = await getOrderProducts(creds, pi.id)
  if (!prodRes.ok) return { ok: false, error: `getOrderProducts 失敗: ${prodRes.error}` }

  const orders: PatiscoOrderWithProducts[] = prodRes.data?.orders ?? []
  const products: PatiscoPIProduct[] = orders[0]?.Products ?? pi.Products ?? []
  const rawCurrencyCode = orders[0]?.CurrencyCode ?? pi.priceText?.split(' ')[1]
  const currency = resolvePatiscoCurrency(rawCurrencyCode, 'TWD')

  // ── 找或建 SLS_Order ──────────────────────────────────────────────────────
  let order = await prisma.sLS_Order.findFirst({
    where: { OR: [{ patiscoDocId: piId }, { orderNo: `P-${pi.no}` }] },
  })

  if (!order) {
    // 計算訂單總額
    const totalAmount = products.reduce((sum, p) => {
      const price = parseFloat(String(p.Price ?? '0')) || 0
      const qty   = parseInt(String(p.Quantity ?? '0'), 10) || 0
      return sum + price * qty
    }, 0)

    order = await prisma.sLS_Order.create({
      data: {
        orderNo:          `P-${pi.no}`,   // 前綴 P- 避免和手動訂單衝突
        customerId,
        status:           1,               // 1 = 確認中
        currencyCode:     currency,
        exchangeRate:     new Decimal(1),  // Patisco 不提供匯率，預設 1，可人工更新
        totalAmount:      new Decimal(totalAmount),
        source:           'PATISCO',
        patiscoBuyerId:   pi.buyer ?? null,
        patiscoBuyerName: pi.buyer ?? null,
        patiscoDocId:     piId,
        patiscoDocNo:     pi.no,
        createdBy:        systemUserId,
      },
    })
  }

  // ── 找或建 SLS_PI（去重：patiscoDocId 或 piNo 任一存在即跳過）────────────
  const existingPI = await prisma.sLS_PI.findFirst({
    where: { OR: [{ patiscoDocId: piId }, { piNo: pi.no }] },
  })
  if (existingPI) {
    return { ok: true, items: [] }  // 已處理過
  }

  const slsPi = await prisma.sLS_PI.create({
    data: {
      orderId:        order.id,
      piNo:           pi.no,
      source:         'PATISCO',
      patiscoDocId:   piId,
      patiscoDocNo:   pi.no,
      tradeTermsCode: isNaN(tradeTermsCode as number) ? null : tradeTermsCode,
      extraCharges:   extraCharges.length > 0 ? extraCharges : undefined,
    },
  })

  // ── 逐項處理庫存 ─────────────────────────────────────────────────────────
  const itemResults: Array<{ sku: string; qty: number; reservedAfter: number }> = []
  let hasUnmatched = false

  for (const item of products) {
    let product = await findProduct(prisma, item)

    // 找不到 → 自動建立草稿商品，再做 AI 豐富化
    if (!product) {
      if (!item.SKU && !item.ModelNo) {
        hasUnmatched = true
        console.warn(`[patisco-sync] PI ${pi.no} 商品無 SKU/ModelNo，跳過`)
        continue
      }
      const created = await prisma.pRD_Product.create({
        data: {
          name:          item.ModelNo?.trim() || item.SKU || '未命名商品',
          sku:           item.SKU || null,
          modelNo:       item.ModelNo?.trim() || null,
          specification: item.Specification || null,
          unit:          item.Unit || null,
          patiscoProductId: item.ID,
        },
        select: { id: true, sku: true },
      })
      product = created
      console.log(`[patisco-sync] 自動建立商品 SKU=${item.SKU} id=${created.id}`)
    }

    const qty = parseInt(String(item.Quantity), 10) || 0
    if (qty <= 0) continue

    // AI 豐富化（補名稱、HS Code、更新供應商報價）— fire-and-forget，不阻擋主流程
    enrichProduct(prisma, product.id, {
      sku:          item.SKU,
      modelNo:      item.ModelNo?.trim(),
      specification: item.Specification,
      unitPrice:    parseFloat(String(item.Price ?? '0')) || undefined,
      systemUserId,
    }).catch(e => console.warn('[patisco-sync] enrichProduct 失敗', e))

    // 找或建 SLS_Item
    let slsItem = await prisma.sLS_Item.findFirst({
      where: { orderId: order.id, productId: product.id },
    })
    if (!slsItem) {
      slsItem = await prisma.sLS_Item.create({
        data: {
          orderId:    order.id,
          productId:  product.id,
          unitPrice:  new Decimal(parseFloat(String(item.Price ?? '0')) || 0),
          quantity:   qty,
          unit:       item.Unit ?? null,
          note:       item.Note ?? item.Notes ?? null,
        },
      })
    }

    // SLS_PIItem（PI 明細與訂單明細的對應）
    await prisma.sLS_PIItem.create({
      data: {
        piId:      slsPi.id,
        slsItemId: slsItem.id,
        quantity:  qty,
      },
    }).catch(() => {}) // 可能重複，忽略

    // reservedQty++
    const stock = await prisma.iNV_Stock.upsert({
      where:  { productId: product.id },
      create: { productId: product.id, quantity: 0, reservedQty: qty, safetyStock: 0 },
      update: { reservedQty: { increment: qty } },
    })

    // INV_Movement type=2（PI 正本確認，預留庫存）
    await prisma.iNV_Movement.create({
      data: {
        productId:       product.id,
        type:            2,
        qtyDelta:        0,
        reservedDelta:   qty,
        quantityAfter:   stock.quantity,
        reservedAfter:   stock.reservedQty,
        source:          'PATISCO',
        slsPiId:         slsPi.id,
        patiscoDocType:  'PI',
        patiscoDocId:    piId,
        patiscoDocNo:    pi.no,
        note:            `Patisco PI 確認預留：${pi.no}`,
      },
    })

    itemResults.push({ sku: product.sku ?? item.SKU ?? item.ID, qty, reservedAfter: stock.reservedQty })
  }

  return {
    ok:      true,
    partial: hasUnmatched,
    items:   itemResults,
  }
}

// ─── 供應商 PI 副本：建 PO_SupplierPI，入倉由人工確認 ────────────────────────

async function processSupplierPI(
  prisma: PrismaClient,
  creds: Awaited<ReturnType<typeof patiscoLogin>>,
  pi: PatiscoPI,
  supplierId: number,
  systemUserId: number,
  source: SyncSource,
): Promise<{ ok: boolean; error?: string }> {
  if (!creds) return { ok: false, error: 'auth failed' }

  const piId = pi.no

  // 已存在則跳過
  const existingSupPI = await prisma.pO_SupplierPI.findFirst({
    where: { patiscoDocId: piId },
  })
  if (existingSupPI) return { ok: true }

  // 拉 PI header（extraCharges、tradeTermsCode）
  const detailRes = await getOrderDetail(creds, pi.id)
  const orderDetail = detailRes.ok ? (detailRes.data?.order ?? null) : null
  const tradeTermsCode = orderDetail?.payment != null ? parseInt(String(orderDetail.payment), 10) : null
  const extraCharges: PatiscoExtraCharge[] = orderDetail?.extraCharges ?? []

  // 找對應的 PO_Order（先用 patiscoOrderId 找，找不到就建草稿）
  let poOrder = await prisma.pO_Order.findFirst({
    where: { supplierId, patiscoOrderId: piId },
  })

  if (!poOrder) {
    // 拉明細，嘗試建草稿 PO_Order
    const prodRes = await getOrderProducts(creds, pi.id)
    const orders = prodRes.ok ? (prodRes.data?.orders ?? []) : []
    const products: PatiscoPIProduct[] = orders[0]?.Products ?? pi.Products ?? []
    const rawCurrency = orders[0]?.CurrencyCode ?? pi.priceText?.split(' ')[1]

    poOrder = await prisma.pO_Order.create({
      data: {
        poNo:            `SP-${pi.no}`,  // SP- = Supplier PI 草稿
        supplierId,
        status:          0,              // 0 = 草稿（等人工確認後升為正式）
        currencyCode:    resolvePatiscoCurrency(rawCurrency, 'TWD'),
        exchangeRate:    new Decimal(1),
        sourceType:      0,
        patiscoOrderNo:  pi.no,
        patiscoOrderId:  piId,
        createdBy:       systemUserId,
        // 同時建立採購明細（找不到的商品自動建立）
        items: {
          create: (await Promise.all(products.map(async p => {
            let product = await findProduct(prisma, p)
            if (!product) {
              if (!p.SKU && !p.ModelNo) return null
              const created = await prisma.pRD_Product.create({
                data: {
                  name:          p.ModelNo?.trim() || p.SKU || '未命名商品',
                  sku:           p.SKU || null,
                  modelNo:       p.ModelNo?.trim() || null,
                  specification: p.Specification || null,
                  unit:          p.Unit || null,
                  patiscoProductId: p.ID,
                },
                select: { id: true, sku: true },
              }).catch(() => null)
              if (!created) return null
              product = created
            }
            // AI 豐富化 — fire-and-forget
            enrichProduct(prisma, product.id, {
              sku:           p.SKU,
              modelNo:       p.ModelNo?.trim(),
              specification: p.Specification,
              unitPrice:     parseFloat(String(p.Price ?? '0')) || undefined,
              supplierId,
              systemUserId,
            }).catch(e => console.warn('[patisco-sync] enrichProduct 失敗', e))

            return {
              productId: product.id,
              unitPrice: new Decimal(parseFloat(String(p.Price ?? '0')) || 0),
              quantity:  parseInt(String(p.Quantity), 10) || 0,
              unit:      p.Unit ?? null,
              note:      p.Note ?? p.Notes ?? null,
            }
          }))).filter(Boolean) as Array<{
            productId: number
            unitPrice: Decimal
            quantity: number
            unit: string | null
            note: string | null
          }>,
        },
      },
    })
  }

  // 建 PO_SupplierPI（記錄供應商確認的出貨資訊，不動庫存）
  await prisma.pO_SupplierPI.create({
    data: {
      orderId:        poOrder.id,
      piNo:           pi.no,
      source:         'PATISCO',
      performedBy:    null,
      patiscoDocId:   piId,
      patiscoDocNo:   pi.no,
      tradeTermsCode: isNaN(tradeTermsCode as number) ? null : tradeTermsCode,
      extraCharges:   extraCharges.length > 0 ? extraCharges : undefined,
    },
  })

  return { ok: true }
}

// ─── Patisco 供應商同步（getSellers → SUP_Supplier upsert）──────────────────

export type SellerSyncResult = {
  total: number
  created: number
  updated: number
  skipped: number
  errors: number
}

export async function syncPatiscoSellers(source: SyncSource, db?: PrismaClient, sharedCreds?: PatiscoCredentials & { _mcpUrl: string }): Promise<SellerSyncResult> {
  const prisma = db ?? defaultPrisma
  const result: SellerSyncResult = { total: 0, created: 0, updated: 0, skipped: 0, errors: 0 }

  const creds = sharedCreds ?? await patiscoLogin(prisma)
  if (!creds) {
    console.warn('[patisco-sellers] 未設定 PATISCO 帳密，跳過供應商同步')
    return result
  }

  // 分頁拉取全部賣家（每頁 50，直到沒有更多）
  let offset = 0
  const pageSize = 50
  let hasMore = true

  while (hasMore) {
    const res = await getSellers(creds, { first: pageSize, offset })
    if (!res.ok) {
      console.error('[patisco-sellers] getSellers 失敗', res.error)
      break
    }

    const items: PatiscoSeller[] = res.data?.items ?? []
    const totalCount = parseInt(String(res.data?.totalCount ?? '0'), 10) || 0
    result.total = totalCount

    if (items.length === 0) break

    for (const seller of items) {
      const patiscoSellerId = seller.ID
      if (!patiscoSellerId || !seller.Name?.trim()) { result.skipped++; continue }

      try {
        const data = {
          name:          seller.Name.trim(),
          address:       seller.Address       ?? null,
          city:          seller.City          ?? null,
          countryCode:   seller.CountryCode   ?? null,
          postalCode:    seller.PostalCode    ?? null,
          phoneNo:       seller.PhoneNo       ?? null,
          fax:           seller.FAX           ?? null,
          email:         seller.EMail         ?? null,
          taxId:         seller.TaxID         ?? null,
          contactPerson: seller.ContactPerson ?? null,
          note:          seller.Note          ?? null,
          patiscoSupplierId: patiscoSellerId,
        }

        // 先用 patiscoSupplierId 找（最精確），再用 taxId，再用名稱精確比對
        let existing = await prisma.sUP_Supplier.findFirst({ where: { patiscoSupplierId: patiscoSellerId } })
        if (!existing && seller.TaxID) {
          existing = await prisma.sUP_Supplier.findFirst({ where: { taxId: seller.TaxID } })
        }
        if (!existing) {
          existing = await prisma.sUP_Supplier.findFirst({
            where: { name: { equals: seller.Name.trim(), mode: 'insensitive' } },
          })
        }

        if (existing) {
          await prisma.sUP_Supplier.update({ where: { id: existing.id }, data })
          result.updated++
        } else {
          await prisma.sUP_Supplier.create({ data })
          result.created++
        }
      } catch (err) {
        console.error(`[patisco-sellers] 供應商同步失敗 ID=${seller.ID}`, err)
        result.errors++
      }
    }

    offset += items.length
    hasMore = offset < totalCount && items.length === pageSize
  }

  console.log(`[patisco-sellers] 供應商同步完成 total=${result.total} created=${result.created} updated=${result.updated} errors=${result.errors}`)
  return result
}

// ─── Patisco 客戶同步（getBuyers → CUS_Customer upsert）─────────────────────

export async function syncPatiscoBuyers(source: SyncSource, db?: PrismaClient, sharedCreds?: PatiscoCredentials & { _mcpUrl: string }): Promise<BuyerSyncResult> {
  const prisma = db ?? defaultPrisma
  const result: BuyerSyncResult = { total: 0, created: 0, updated: 0, skipped: 0, errors: 0 }

  const creds = sharedCreds ?? await patiscoLogin(prisma)
  if (!creds) {
    console.warn('[patisco-sync] 未設定 PATISCO 帳密，跳過客戶同步')
    return result
  }

  const buyersRes = await getBuyers(creds, { first: 200, orderBy: 'CreatedDate_DESC' })
  if (!buyersRes.ok) {
    console.error('[patisco-sync] getBuyers 失敗', buyersRes.error)
    return result
  }

  const buyers: PatiscoBuyer[] = buyersRes.data?.items ?? []
  result.total = buyers.length

  for (const buyer of buyers) {
    const patiscoBuyerId = buyer.ID
    if (!patiscoBuyerId) { result.skipped++; continue }

    try {
      const existing = await prisma.cUS_Customer.findFirst({ where: { patiscoBuyerId } })
      const data = {
        name:          buyer.Name,
        address:       buyer.Address       ?? null,
        city:          buyer.City          ?? null,
        countryCode:   buyer.CountryCode   ?? null,
        postalCode:    buyer.PostalCode    ?? null,
        phoneNo:       buyer.PhoneNo       ?? null,
        fax:           buyer.FAX           ?? null,
        email:         buyer.EMail         ?? null,
        contactPerson: buyer.ContactPerson ?? null,
        taxId:         buyer.TaxID         ?? null,
        note:          buyer.Note          ?? null,
        patiscoBuyerId,
      }

      if (existing) {
        await prisma.cUS_Customer.update({ where: { id: existing.id }, data })
        result.updated++
      } else {
        await prisma.cUS_Customer.create({ data })
        result.created++
      }
    } catch (err) {
      console.error(`[patisco-sync] 客戶同步失敗 ID=${buyer.ID}`, err)
      result.errors++
    }
  }

  console.log(`[patisco-sync] 客戶同步完成 created=${result.created} updated=${result.updated} errors=${result.errors}`)
  return result
}

// ─── Patisco PO 同步（Type=1，Point Asia 當 Buyer）────────────────────────────
//
// 每筆 PO 的 seller = 供應商。同步：
//   1. SUP_Supplier upsert（從 seller 物件）
//   2. PO_Order（草稿，待人工確認入倉）
//   3. PO_Item（從 getOrderDetail.items，getOrderProducts 對 PO 無效）

export async function syncPatiscoSupplierPOs(source: SyncSource, db?: PrismaClient, dbUrl?: string, sharedCreds?: PatiscoCredentials & { _mcpUrl: string }): Promise<SyncResult> {
  const prisma = db ?? defaultPrisma
  const resolvedDbUrl = dbUrl ?? process.env.DATABASE_URL!
  const sql = neon(resolvedDbUrl)
  const result: SyncResult = { total: 0, skipped: 0, processed: 0, errors: 0, details: [] }

  // 優先用外部傳入的 sharedCreds，避免多次 login 互蓋 Patisco server-side session
  const creds = sharedCreds ?? await patiscoLogin(prisma)
  if (!creds) {
    console.warn('[patisco-po-sync] 未設定 PATISCO 帳密，跳過')
    return result
  }

  const systemUser = await prisma.sYS_User.findFirst({ orderBy: { id: 'asc' } })
  const systemUserId = systemUser?.id ?? 1

  // 讀取供應商清單與公司別名（用於比對 Seller）
  const suppliers = await prisma.sUP_Supplier.findMany({
    where: { isActive: true },
    select: { id: true, name: true, patiscoSupplierId: true },
  })
  const allAliasesPO = await prisma.sYS_CompanyAlias.findMany({
    select: { alias: true, role: true, customerId: true, supplierId: true },
  })
  const aliasMap = new Map(allAliasesPO.map(a => [a.alias.trim().toLowerCase(), a]))

  // listOrderCopies 拉供應商 PO 副本（我方為 Buyer）
  // 不管狀態（0=Editing, 1=Confirmed...）一律全拉，每個 status 分頁抓到底
  // status: 0=Editing, 1=Confirmed, 2=Archived, 4=Cancelled（無 3，依官方文件）
  const STATUS_VALUES = ['0', '1', '2', '4']
  const PAGE_SIZE = 50  // offset = 取回筆數
  const allCopies: import('./client').PatiscoOrderCopy[] = []
  const debugByStatus: Record<string, unknown> = {}

  for (const s of STATUS_VALUES) {
    let startIdx = 0
    let statusTotal = 0
    let fetched = 0

    while (true) {
      const r = await listOrderCopies(creds, { status: s, first: startIdx, offset: PAGE_SIZE })
      if (!r.ok) {
        debugByStatus[`status_${s}`] = { error: (r as any).error }
        break
      }
      const items = r.data?.items ?? []
      statusTotal = parseInt(String((r.data as any)?.totalCount ?? '0'), 10) || items.length
      allCopies.push(...items)
      fetched += items.length
      if (items.length < PAGE_SIZE || fetched >= statusTotal) break
      startIdx += items.length
    }
    if (!debugByStatus[`status_${s}`]) {
      debugByStatus[`status_${s}`] = { fetched, totalCount: statusTotal }
    }
  }

  ;(result as any)._debug = { byStatus: debugByStatus, totalCollected: allCopies.length }

  const copies = allCopies
  result.total = copies.length
  console.log(`[patisco-po-sync] listOrderCopies 全狀態拉到 ${copies.length} 筆 PO`)

  for (const copy of copies) {
    // listOrderCopies 回傳大寫欄位（ID, No, Seller...）
    const docId: string = (copy.ID ?? copy.id ?? '').toString()
    const docNo: string = (copy.No ?? copy.no ?? '').toString()

    if (!docId) {
      console.warn('[patisco-po-sync] copy 缺少 id，略過：', JSON.stringify(copy).substring(0, 100))
      result.skipped++
      continue
    }

    // 去重
    const syncRows = await execSQL(sql,
      `SELECT id, status FROM "SYS_PatiscoSync" WHERE "docType" = 'PO' AND "patiscoDocId" = '${esc(docId)}' LIMIT 1`
    )
    const existing = (syncRows[0] as { id: number; status: string } | undefined) ?? null
    if (existing?.status === 'ok' || existing?.status === 'partial') {
      result.skipped++
      continue
    }
    if (existing?.status === 'error') {
      await prisma.sYS_PatiscoSync.deleteMany({ where: { id: existing.id } })
    }

    try {
      // ── 直接從 listOrderCopies header 取資料 ──────────────────────────────
      // 注意：getOrderCopyDetail / getOrderCopyProducts 目前對買方角色回傳 Forbidden / GraphQL 錯誤
      // 已回報 Patisco，待修復後再補 detail sync。Header 已足夠建立 PO 記錄。
      const sellerName = copy.Seller ?? copy.seller ?? ''
      const rawCurrency = copy.CurrencyCode ?? copy.priceText?.split(' ')[1]
      const currencyCode = resolvePatiscoCurrency(rawCurrency, 'TWD')
      const tradeTermsCode = copy.TradingCode != null ? parseInt(String(copy.TradingCode), 10) : null
      const itemsCount = parseInt(String(copy.ItemsCount ?? '0'), 10) || 0

      // 解析 CreatedDate（格式：YYYYMMDDHHmmss）
      let patiscoCreatedAt: Date | null = null
      const cd = copy.CreatedDate ?? copy.createdDate ?? ''
      if (cd && cd.length >= 8) {
        const y  = parseInt(cd.substring(0,4), 10)
        const mo = parseInt(cd.substring(4,6), 10) - 1
        const d  = parseInt(cd.substring(6,8), 10)
        const h  = cd.length >= 10 ? parseInt(cd.substring(8,10), 10) : 0
        const mi = cd.length >= 12 ? parseInt(cd.substring(10,12), 10) : 0
        const s  = cd.length >= 14 ? parseInt(cd.substring(12,14), 10) : 0
        const dt = new Date(Date.UTC(y, mo, d, h, mi, s))
        if (!isNaN(dt.getTime())) patiscoCreatedAt = dt
      }

      // ── 供應商比對（別名表優先，找不到則 needs_confirm，不自動建立）──────
      let supplierId: number | null = null
      if (!sellerName.trim()) {
        await recordSync(sql, 'PO', docId, docNo, source, 'skipped', null, `Seller 名稱為空，略過`)
        result.skipped++
        continue
      }

      const supplierMatch = matchSupplierWithAlias(sellerName, suppliers, aliasMap)
      if (supplierMatch === 'UNKNOWN') {
        // 找不到 → 停下來等使用者確認
        await recordSync(sql, 'PO', docId, docNo, source, 'needs_confirm',
          { unknownCompanies: [{ name: sellerName, roleHint: 'SUPPLIER', docType: '正PO' }] }, null)
        result.skipped++
        result.details.push({ patiscoDocNo: docNo, status: 'skipped',
          msg: `賣方「${sellerName}」尚未建檔，請至 Patisco 設定頁確認公司角色後重試` })
        continue
      } else if (supplierMatch) {
        supplierId = supplierMatch.id
      }

      if (!supplierId) {
        await recordSync(sql, 'PO', docId, docNo, source, 'skipped', null, `無法識別 Seller，略過`)
        result.skipped++
        continue
      }

      // ── PO_Order 找或建 ────────────────────────────────────────────────────
      let poOrder = await prisma.pO_Order.findFirst({
        where: { OR: [{ patiscoOrderId: docId }, { poNo: `PA-${docNo}` }] },
        select: { id: true },
      })

      if (!poOrder) {
        poOrder = await prisma.pO_Order.create({
          data: {
            poNo:           `PA-${docNo}`,   // PA- = Patisco 採購副本
            supplierId,
            status:         0,               // 草稿，等人工確認入倉
            currencyCode,
            exchangeRate:   new Decimal(1),
            sourceType:     0,               // 0 = Patisco 匯入
            patiscoOrderNo: docNo,
            patiscoOrderId: docId,
            createdBy:      systemUserId,
            // items 暫無（getOrderCopyProducts Forbidden，待 Patisco 修復）
          },
          select: { id: true },
        })
      }

      // ── PO_SupplierPI（如尚未存在）────────────────────────────────────────
      const existingSupPI = await prisma.pO_SupplierPI.findFirst({ where: { patiscoDocId: docId } })
      if (!existingSupPI) {
        await prisma.pO_SupplierPI.create({
          data: {
            orderId:        poOrder.id,
            piNo:           docNo,
            source:         'PATISCO',
            performedBy:    null,
            patiscoDocId:   docId,
            patiscoDocNo:   docNo,
            tradeTermsCode: isNaN(tradeTermsCode as number) ? null : tradeTermsCode,
            ...(patiscoCreatedAt ? { patiscoCreatedAt } : {}),
          },
        })
      }

      await recordSync(sql, 'PO', docId, docNo, source, 'ok', { supplierId, itemsCount }, null)
      result.processed++
      result.details.push({ patiscoDocNo: docNo, status: 'ok', msg: `供應商 ${sellerName}，${itemsCount} 項商品（明細待 Patisco 修復後補入）` })

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[patisco-po-sync] 處理 PO ${docNo} 失敗`, err)
      await recordSync(sql, 'PO', docId, docNo, source, 'error', null, msg)
      result.errors++
      result.details.push({ patiscoDocNo: docNo, status: 'error', msg })
    }
  }

  console.log(`[patisco-po-sync] 完成 processed=${result.processed} skipped=${result.skipped} errors=${result.errors}`)
  return result
}

// ─── Helper：從 PO seller 物件 upsert SUP_Supplier ──────────────────────────

async function upsertSupplierFromPO(
  prisma: PrismaClient,
  seller: {
    name?: string
    address?: string
    city?: string
    countryCode?: string
    postalCode?: string
    phoneNo?: string
    email?: string
    fax?: string
    taxId?: string
  },
  tradeTermsCode: number | null,
): Promise<number | null> {
  if (!seller.name?.trim()) return null

  const data = {
    name:         seller.name.trim(),
    address:      seller.address ?? null,
    city:         seller.city ?? null,
    countryCode:  seller.countryCode ?? null,
    postalCode:   seller.postalCode ?? null,
    phoneNo:      seller.phoneNo ?? null,
    fax:          seller.fax ?? null,
    email:        seller.email ?? null,
    taxId:        seller.taxId ?? null,
    ...(tradeTermsCode != null && !isNaN(tradeTermsCode)
      ? { defaultTradeTerms: tradeTermsCode }
      : {}),
  }

  // 先用 taxId 找（最精確）
  if (seller.taxId) {
    const byTax = await prisma.sUP_Supplier.findFirst({ where: { taxId: seller.taxId } })
    if (byTax) {
      await prisma.sUP_Supplier.update({ where: { id: byTax.id }, data })
      return byTax.id
    }
  }

  // 再用名稱精確比對
  const byName = await prisma.sUP_Supplier.findFirst({
    where: { name: { equals: seller.name.trim(), mode: 'insensitive' } },
  })
  if (byName) {
    await prisma.sUP_Supplier.update({ where: { id: byName.id }, data })
    return byName.id
  }

  // 建新供應商
  const created = await prisma.sUP_Supplier.create({ data })
  console.log(`[patisco-po-sync] 自動建立供應商：${seller.name} (id=${created.id})`)
  return created.id
}

// ─── Helper：比對客戶（別名表優先 → 精確匹配 → fuzzy 備援）─────────────────
// 回傳值：{ id } = 找到；null = 名稱為空；'UNKNOWN' = 有名稱但找不到任何匹配

function matchCustomerWithAlias(
  buyerName: string,
  customers: Array<{ id: number; name: string; patiscoBuyerId: string | null }>,
  aliasMap: Map<string, { role: string; customerId: number | null; supplierId: number | null }>,
): { id: number } | null | 'UNKNOWN' {
  if (!buyerName?.trim()) return null
  const low = buyerName.trim().toLowerCase()

  // 1. 別名表：已知 CUSTOMER
  const aliasEntry = aliasMap.get(low)
  if (aliasEntry?.role === 'CUSTOMER' && aliasEntry.customerId) {
    return { id: aliasEntry.customerId }
  }
  // 別名表標記為 OTHER → 明確忽略
  if (aliasEntry?.role === 'OTHER') return null

  // 2. CUS_Customer 精確比對
  const exact = customers.find(c => c.name.trim().toLowerCase() === low)
  if (exact) return exact

  // 3. CUS_Customer fuzzy 備援（包含比對）
  const fuzzy = customers.find(c =>
    low.includes(c.name.trim().toLowerCase()) ||
    c.name.trim().toLowerCase().includes(low)
  )
  if (fuzzy) return fuzzy

  // 4. 完全找不到 → 需要使用者確認
  return 'UNKNOWN'
}

// ─── Helper：比對供應商（別名表優先 → 精確匹配 → fuzzy 備援）──────────────
// 回傳值：{ id } = 找到；null = 名稱為空；'UNKNOWN' = 有名稱但找不到任何匹配

function matchSupplierWithAlias(
  sellerName: string,
  suppliers: Array<{ id: number; name: string; patiscoSupplierId: string | null }>,
  aliasMap: Map<string, { role: string; customerId: number | null; supplierId: number | null }>,
): { id: number } | null | 'UNKNOWN' {
  if (!sellerName?.trim()) return null
  const low = sellerName.trim().toLowerCase()

  // 1. 別名表：已知 SUPPLIER
  const aliasEntry = aliasMap.get(low)
  if (aliasEntry?.role === 'SUPPLIER' && aliasEntry.supplierId) {
    return { id: aliasEntry.supplierId }
  }
  // 別名表標記為 OTHER → 明確忽略
  if (aliasEntry?.role === 'OTHER') return null

  // 2. SUP_Supplier 精確比對
  const exact = suppliers.find(s => s.name.trim().toLowerCase() === low)
  if (exact) return exact

  // 3. SUP_Supplier fuzzy 備援（包含比對）
  const fuzzy = suppliers.find(s =>
    low.includes(s.name.trim().toLowerCase()) ||
    s.name.trim().toLowerCase().includes(low)
  )
  if (fuzzy) return fuzzy

  // 4. 完全找不到 → 需要使用者確認
  return 'UNKNOWN'
}

// ─── Helper：比對商品（SKU 優先，ModelNo 備援）────────────────────────────────

async function findProduct(
  prisma: PrismaClient,
  item: PatiscoPIProduct,
) {
  if (item.SKU) {
    const p = await prisma.pRD_Product.findFirst({
      where: { sku: item.SKU, isActive: true },
      select: { id: true, sku: true },
    })
    if (p) return p
  }
  if (item.ModelNo) {
    const p = await prisma.pRD_Product.findFirst({
      where: { modelNo: item.ModelNo, isActive: true },
      select: { id: true, sku: true },
    })
    if (p) return p
  }
  // patiscoProductId 備援
  return prisma.pRD_Product.findFirst({
    where: { patiscoProductId: item.ID, isActive: true },
    select: { id: true, sku: true },
  })
}

// ─── Helper：寫同步紀錄 ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recordSync(
  sql: any,
  docType: string,
  patiscoDocId: string,
  patiscoDocNo: string,
  source: SyncSource,
  status: string,
  result: unknown,
  errorMsg: string | null,
) {
  try {
    const resultJson = esc(JSON.stringify(result ?? {}))
    const errVal = errorMsg ? `'${esc(errorMsg)}'` : 'NULL'
    await execSQL(sql,
      `INSERT INTO "SYS_PatiscoSync" ("docType","patiscoDocId","patiscoDocNo","source","status","result","errorMsg","syncedAt")
       VALUES ('${esc(docType)}','${esc(patiscoDocId)}','${esc(patiscoDocNo)}','${esc(source)}','${esc(status)}','${resultJson}'::jsonb,${errVal},NOW())`
    )
  } catch (err) {
    console.warn('[patisco-sync] recordSync 寫入失敗', err)
  }
}
