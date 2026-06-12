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
  listProformaInvoices,
  listProformaInvoiceCopies,
  listPurchaseOrders,
  listDeliveryOrders,
  getDeliveryOrderDetail,
  getOrderProducts,
  getOrderDetail,
  extractOrderDetail,
  getOrderCopyDetail,
  getOrderCopyProducts,
  resolvePatiscoCurrency,
  PATISCO_CURRENCY,
  type PatiscoCredentials,
  type PatiscoPI,
  type PatiscoPIProduct,
  type PatiscoOrderDetailItem,
  type PatiscoOrderWithProducts,
  type PatiscoExtraCharge,
  type PatiscoOrderCopyProduct,
} from './client'

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

function esc(v: string | null | undefined) { return (v ?? '').replace(/'/g, "''") }

// getOrderDetail 的產品可能在 data.products.items（新版）或 data.detail.items（舊版）
function extractDetailProducts(data: import('./client').GetOrderDetailResult | undefined): import('./client').PatiscoOrderDetailItem[] {
  if (!data) return []
  const topLevel = data.products?.items ?? []
  if (topLevel.length > 0) return topLevel
  return (data.detail as { items?: import('./client').PatiscoOrderDetailItem[] } | undefined)?.items
    ?? (data.order as { items?: import('./client').PatiscoOrderDetailItem[] } | undefined)?.items
    ?? []
}

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

  // 4. 拉取所有 PI（listProformaInvoices，autoExpanded 自動展開 < 100 筆）
  const allPIs: PatiscoPI[] = []
  let page = 1
  while (true) {
    const piRes = await listProformaInvoices(creds, page)
    if (!piRes.ok) {
      console.error(`[patisco-sync] listProformaInvoices page=${page} 失敗`, piRes.error)
      break
    }
    const data = piRes.data
    const items = data?.items ?? []
    allPIs.push(...items)
    if (!data?.hasNextPage || data?.autoExpanded) break
    page++
  }
  const pis: PatiscoPI[] = allPIs
  result.total = pis.length

  // 5a. 一次撈完所有 PI 的 sync 紀錄（避免迴圈內每筆都打 DB）
  const existingSyncRows = await execSQL(sql,
    `SELECT "patiscoDocId", id, status FROM "SYS_PatiscoSync" WHERE "docType" = 'PI'`
  ) as { patiscoDocId: string; id: number; status: string }[]
  const syncMap = new Map(existingSyncRows.map(r => [r.patiscoDocId, r]))

  // 25 秒預算：Vercel function 最多 30s，留 5s buffer 給回應
  // 超時後停止，下次 sync 從 SYS_PatiscoSync 已 ok 的繼續跳過
  const BUDGET_MS = 25_000
  const startMs = Date.now()

  // 5. 逐張處理
  for (const pi of pis) {
    if (Date.now() - startMs > BUDGET_MS) {
      console.warn(`[patisco-sync] 已達時間預算 ${BUDGET_MS}ms，剩餘 PI 留待下次處理`)
      break
    }
    const docId = pi.no
    const docNo = pi.no
    const sellerName = pi.seller ?? ''
    const buyerName  = pi.buyer  ?? ''

    // 去重：成功 / 部分成功 → 跳過；失敗或 pending（補填用）→ 重試
    const existing = syncMap.get(docId) ?? null
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
        let customer = matchCustomerWithAlias(buyerName, customers, aliasMap)

        if (customer === 'UNKNOWN') {
          // 文件已確定 buyer = 客戶，直接建立主檔（找不到才建）
          const found = await prisma.cUS_Customer.findFirst({
            where: { name: { equals: buyerName, mode: 'insensitive' } },
            select: { id: true, name: true, patiscoBuyerId: true },
          })
          const rec = found ?? await prisma.cUS_Customer.create({ data: { name: buyerName }, select: { id: true, name: true, patiscoBuyerId: true } })
          customers.push(rec)
          customer = { id: rec.id }
        }

        if (!customer) {
          await recordSync(sql, 'PI', docId, docNo, source, 'skipped', null, `Buyer 名稱為空`)
          result.skipped++
          result.details.push({ patiscoDocNo: docNo, status: 'skipped', msg: 'Buyer 名稱為空' })
        } else {
          // 副位 = 客戶 → 我方 PI 正本（customerId 可為 null：角色已確認但尚未關聯主檔）
          const r = await processOurPIToCustomer(prisma, creds, pi, customer.id, buyerName, systemUserId, source)
          const status = r.ok ? (r.partial ? 'partial' : 'ok') : 'error'
          await recordSync(sql, 'PI', docId, docNo, source, status, r.items ?? null, r.error ?? null)
          result.details.push({ patiscoDocNo: docNo, status, items: r.items, msg: r.error })
          r.ok ? result.processed++ : result.errors++
        }
      } else {
        // ── 主位 ≠ 我方公司（副本，我方收到）→ 副PI ─────────────────────────
        let supplier = matchSupplierWithAlias(sellerName, suppliers, aliasMap)

        if (supplier === 'UNKNOWN' || (supplier && supplier.id === null)) {
          // 文件已確定 seller = 供應商，直接建立主檔
          const found = await prisma.sUP_Supplier.findFirst({
            where: { name: { equals: sellerName, mode: 'insensitive' } },
            select: { id: true, name: true, patiscoSupplierId: true },
          })
          const rec = found ?? await prisma.sUP_Supplier.create({ data: { name: sellerName }, select: { id: true, name: true, patiscoSupplierId: true } })
          suppliers.push(rec)
          supplier = { id: rec.id }
        }

        if (!supplier) {
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
  customerId: number | null,
  buyerName: string,
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

  // 拉取 PI 完整資料（header + products 一次取齊）
  const detailRes = await getOrderDetail(creds, pi.id)
  const orderDetail = detailRes.ok ? extractOrderDetail(detailRes.data) : null
  const tradeTermsCode = orderDetail?.payment != null ? parseInt(String(orderDetail.payment), 10) : null
  const extraCharges: PatiscoExtraCharge[] = orderDetail?.extraCharges ?? []

  // 解析 expiredDate（ETD，格式：YYYYMMDD 或 YYYYMMDDHHmmss）
  let piEtd: Date | null = null
  const ed = (orderDetail as Record<string, unknown> | null)?.expiredDate as string | undefined ?? ''
  if (ed && ed.length >= 8) {
    const y = parseInt(ed.substring(0,4), 10)
    const mo = parseInt(ed.substring(4,6), 10) - 1
    const d = parseInt(ed.substring(6,8), 10)
    const dt = new Date(Date.UTC(y, mo, d))
    if (!isNaN(dt.getTime())) piEtd = dt
  }

  // 若有 orderDetail.buyer，順便更新 CUS_Customer 的聯絡資料
  if (customerId && orderDetail?.buyer) {
    const b = orderDetail.buyer
    if (b.name || b.address || b.city || b.email || b.phoneNo) {
      await prisma.cUS_Customer.update({
        where: { id: customerId },
        data: {
          ...(b.address      ? { address: b.address }           : {}),
          ...(b.city         ? { city: b.city }                 : {}),
          ...(b.countryCode  ? { countryCode: b.countryCode }   : {}),
          ...(b.postalCode   ? { postalCode: b.postalCode }      : {}),
          ...(b.phoneNo      ? { phoneNo: b.phoneNo }            : {}),
          ...(b.email        ? { email: b.email }                : {}),
          ...(b.fax          ? { fax: b.fax }                    : {}),
          ...(b.taxId        ? { taxId: b.taxId }                : {}),
        },
      }).catch(() => {})
    }
  }

  // getOrderDetail 已包含 products（autoExpanded=true 時全部一次拿完）
  // 若 products 不在 detail 裡（舊版 fallback），再呼叫 getOrderProducts
  const detailItems: PatiscoOrderDetailItem[] = detailRes.ok
    ? extractDetailProducts(detailRes.data)
    : []

  let products: PatiscoPIProduct[]
  let currency: string

  if (detailItems.length > 0) {
    console.log(`[patisco-sync] first detailItem keys: ${Object.keys(detailItems[0]).join(',')} | sku="${(detailItems[0] as Record<string,unknown>).sku}" SKU="${(detailItems[0] as Record<string,unknown>).SKU}"`)
    products = detailItems.map(i => {
      // API sometimes returns uppercase SKU instead of lowercase sku
      const raw = i as Record<string, unknown>
      return {
        ID: '',
        SKU: (i.sku || (raw.SKU as string | undefined)) ?? undefined,
        ModelNo: (i.modelNo || (raw.ModelNo as string | undefined)) ?? undefined,
        Specification: i.specification ?? undefined,
        Note: i.note ?? null,
        Quantity: i.quantity ?? '0',
        Price: i.price ?? undefined,
        CurrencyCode: i.currencyCode ?? undefined,
        Unit: i.unit ?? undefined,
        NetWeight: i.netWeight ?? null,
        GrossWeight: i.grossWeight ?? null,
        UnitPerCarton: i.unitPerCarton ?? null,
        Length: i.length ?? null,
        Width: i.width ?? null,
        Height: i.height ?? null,
      } satisfies PatiscoPIProduct
    })
    const rawCurrency = detailItems[0]?.currencyCode
    currency = resolvePatiscoCurrency(rawCurrency, 'TWD')
  } else {
    // fallback：呼叫 getOrderProducts
    const prodRes = await getOrderProducts(creds, pi.id)
    const newItems = prodRes.ok ? (prodRes.data?.items ?? []) : []
    const oldOrders: PatiscoOrderWithProducts[] = prodRes.ok ? (prodRes.data?.orders ?? []) : []
    products = newItems.length
      ? newItems.map(i => {
          const raw = i as Record<string, unknown>
          return {
            ID: '',
            SKU: (i.sku || (raw.SKU as string | undefined)) ?? undefined,
            ModelNo: (i.modelNo || (raw.ModelNo as string | undefined)) ?? undefined,
            Specification: i.specification ?? undefined,
            Note: i.note ?? null,
            Quantity: i.quantity ?? '0',
            Price: i.price ?? undefined,
            CurrencyCode: i.currencyCode ?? undefined,
            Unit: i.unit ?? undefined,
            NetWeight: i.netWeight ?? null,
            GrossWeight: i.grossWeight ?? null,
            UnitPerCarton: i.unitPerCarton ?? null,
            Length: i.length ?? null,
            Width: i.width ?? null,
            Height: i.height ?? null,
          } satisfies PatiscoPIProduct
        })
      : (oldOrders[0]?.Products ?? pi.Products ?? [])
    const rawCurrency = oldOrders[0]?.CurrencyCode ?? pi.priceText?.split(' ')[1]
    currency = resolvePatiscoCurrency(rawCurrency, 'TWD')
  }

  // ── 解析 PI 原始建立日期（格式：YYYYMMDDHHmmss）────────────────────────────
  let piPatiscoCreatedAt: Date | null = null
  const piCd = pi.createdDate ?? ''
  if (piCd && piCd.length >= 8) {
    const y  = parseInt(piCd.substring(0,4), 10)
    const mo = parseInt(piCd.substring(4,6), 10) - 1
    const d  = parseInt(piCd.substring(6,8), 10)
    const h  = piCd.length >= 10 ? parseInt(piCd.substring(8,10), 10) : 0
    const mi = piCd.length >= 12 ? parseInt(piCd.substring(10,12), 10) : 0
    const s  = piCd.length >= 14 ? parseInt(piCd.substring(12,14), 10) : 0
    const dt = new Date(Date.UTC(y, mo, d, h, mi, s))
    if (!isNaN(dt.getTime())) piPatiscoCreatedAt = dt
  }

  // ── 找或建 SLS_Order ──────────────────────────────────────────────────────
  let order = await prisma.sLS_Order.findFirst({
    where: { OR: [{ patiscoDocId: piId }, { orderNo: pi.no }] },
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
        orderNo:          pi.no,
        customerId:       customerId ?? undefined,
        status:           1,               // 1 = 確認中
        currencyCode:     currency,
        exchangeRate:     new Decimal(1),  // Patisco 不提供匯率，預設 1，可人工更新
        totalAmount:      new Decimal(totalAmount),
        source:           'PATISCO',
        patiscoBuyerId:   pi.buyer ?? null,
        patiscoBuyerName: buyerName || pi.buyer || null,
        patiscoDocId:     piId,
        patiscoDocNo:     pi.no,
        patiscoCreatedAt: piPatiscoCreatedAt,
        patiscoStatus:    String(pi.status ?? ''),
        createdBy:        systemUserId,
      },
    })
  } else if (!order.patiscoCreatedAt && piPatiscoCreatedAt) {
    // 補填舊資料缺漏的原始建立日期
    await prisma.sLS_Order.update({
      where: { id: order.id },
      data: { patiscoCreatedAt: piPatiscoCreatedAt },
    })
    order = { ...order, patiscoCreatedAt: piPatiscoCreatedAt }
  }

  // ── 找或建 SLS_PI（去重：patiscoDocId 或 piNo 任一存在即跳過）────────────
  const existingPI = await prisma.sLS_PI.findFirst({
    where: { OR: [{ patiscoDocId: piId }, { piNo: pi.no }] },
  })
  if (existingPI) {
    // 補填缺漏欄位
    if (!existingPI.etd && piEtd) {
      await prisma.sLS_PI.update({ where: { id: existingPI.id }, data: { etd: piEtd } })
    }
    return { ok: true, items: [] }
  }

  const slsPi = await prisma.sLS_PI.create({
    data: {
      orderId:        order.id,
      piNo:           pi.no,
      source:         'PATISCO',
      patiscoDocId:   piId,
      patiscoDocNo:   pi.no,
      patiscoStatus:  String(pi.status ?? ''),
      tradeTermsCode: isNaN(tradeTermsCode as number) ? null : tradeTermsCode,
      extraCharges:   extraCharges.length > 0 ? extraCharges : undefined,
      etd:            piEtd ?? undefined,
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

  // 拉 PI 完整資料（header + products 一次取齊）
  const detailRes = await getOrderDetail(creds, pi.id)
  const orderDetail = detailRes.ok ? extractOrderDetail(detailRes.data) : null
  const tradeTermsCode = orderDetail?.payment != null ? parseInt(String(orderDetail.payment), 10) : null
  const extraCharges: PatiscoExtraCharge[] = orderDetail?.extraCharges ?? []

  // 找對應的 PO_Order（先用 patiscoOrderId 找，找不到就建草稿）
  let poOrder = await prisma.pO_Order.findFirst({
    where: { supplierId, patiscoOrderId: piId },
  })

  if (!poOrder) {
    const detailItems: PatiscoOrderDetailItem[] = detailRes.ok
      ? extractDetailProducts(detailRes.data)
      : []

    let products: PatiscoPIProduct[]
    let rawCurrency: string | undefined

    if (detailItems.length > 0) {
      products = detailItems.map(i => ({
        ID: '',
        SKU: i.sku ?? undefined,
        ModelNo: i.modelNo ?? undefined,
        Specification: i.specification ?? undefined,
        Note: i.note ?? null,
        Quantity: i.quantity ?? '0',
        Price: i.price ?? undefined,
        CurrencyCode: i.currencyCode ?? undefined,
        Unit: i.unit ?? undefined,
        NetWeight: i.netWeight ?? null,
        GrossWeight: i.grossWeight ?? null,
        UnitPerCarton: i.unitPerCarton ?? null,
        Length: i.length ?? null,
        Width: i.width ?? null,
        Height: i.height ?? null,
      } satisfies PatiscoPIProduct))
      rawCurrency = detailItems[0]?.currencyCode
    } else {
      const prodRes = await getOrderProducts(creds, pi.id)
      const newItems = prodRes.ok ? (prodRes.data?.items ?? []) : []
      const oldOrders = prodRes.ok ? (prodRes.data?.orders ?? []) : []
      products = newItems.length
        ? newItems.map(i => ({
            ID: '',
            SKU: i.sku ?? undefined,
            ModelNo: i.modelNo ?? undefined,
            Specification: i.specification ?? undefined,
            Note: i.note ?? null,
            Quantity: i.quantity ?? '0',
            Price: i.price ?? undefined,
            CurrencyCode: i.currencyCode ?? undefined,
            Unit: i.unit ?? undefined,
            NetWeight: i.netWeight ?? null,
            GrossWeight: i.grossWeight ?? null,
            UnitPerCarton: i.unitPerCarton ?? null,
            Length: i.length ?? null,
            Width: i.width ?? null,
            Height: i.height ?? null,
          } satisfies PatiscoPIProduct))
        : (oldOrders[0]?.Products ?? pi.Products ?? [])
      rawCurrency = oldOrders[0]?.CurrencyCode ?? pi.priceText?.split(' ')[1]
    }

    poOrder = await prisma.pO_Order.create({
      data: {
        poNo:            pi.no,
        supplierId,
        status:          0,              // 0 = 草稿（等人工確認後升為正式）
        currencyCode:    resolvePatiscoCurrency(rawCurrency, 'TWD'),
        exchangeRate:    new Decimal(1),
        sourceType:      0,
        patiscoOrderNo:  pi.no,
        patiscoOrderId:  piId,
        patiscoStatus:   String(pi.status ?? ''),
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
      patiscoStatus:  String(pi.status ?? ''),
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

export async function syncPatiscoSellers(_source: SyncSource, _db?: PrismaClient, _sharedCreds?: PatiscoCredentials & { _mcpUrl: string }): Promise<SellerSyncResult> {
  // getSellers API 已在新版 Patisco MCP 中移除，供應商資料改從訂單明細同步
  console.warn('[patisco-sellers] getSellers API 已移除，跳過獨立供應商同步')
  return { total: 0, created: 0, updated: 0, skipped: 0, errors: 0 }
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

  // getBuyers API 已在新版 Patisco MCP 中移除，客戶資料改從訂單明細同步
  console.warn('[patisco-sync] getBuyers API 已移除，跳過獨立客戶同步')
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

  // ── listProformaInvoiceCopies：供應商 PI 副本（我方為 Buyer，建 PO_SupplierPI）──
  const allPICopies: import('./client').PatiscoOrderCopy[] = []
  let piCopyPage = 1
  while (true) {
    const r = await listProformaInvoiceCopies(creds, piCopyPage)
    if (!r.ok) {
      console.error(`[patisco-po-sync] listProformaInvoiceCopies 失敗: ${(r as any).error}`)
      break
    }
    const items = r.data?.items ?? []
    allPICopies.push(...items)
    if (!r.data?.hasNextPage || r.data?.autoExpanded) break
    piCopyPage++
  }
  console.log(`[patisco-po-sync] listProformaInvoiceCopies 拉到 ${allPICopies.length} 筆供應商 PI 副本`)

  // ── listPurchaseOrders：我方發出的 PO 正本（建 PO_Order，source=PATISCO）──
  const allPOOrders: import('./client').PatiscoOrderCopy[] = []
  let poPage = 1
  while (true) {
    const r = await listPurchaseOrders(creds, poPage)
    if (!r.ok) {
      console.error(`[patisco-po-sync] listPurchaseOrders 失敗: ${(r as any).error}`)
      break
    }
    const items = r.data?.items ?? []
    allPOOrders.push(...items)
    if (!r.data?.hasNextPage || r.data?.autoExpanded) break
    poPage++
  }
  console.log(`[patisco-po-sync] listPurchaseOrders 拉到 ${allPOOrders.length} 筆 PO 正本`)

  // 合併：PI 副本 + PO 正本，標記來源以便後面建立正確資料
  type CopyWithKind = import('./client').PatiscoOrderCopy & { _kind: 'pi_copy' | 'po_order' }
  const copies: CopyWithKind[] = [
    ...allPICopies.map(c => ({ ...c, _kind: 'pi_copy' as const })),
    ...allPOOrders.map(c => ({ ...c, _kind: 'po_order' as const })),
  ]

  ;(result as any)._debug = { piCopies: allPICopies.length, poOrders: allPOOrders.length, totalCollected: copies.length }

  result.total = copies.length
  console.log(`[patisco-po-sync] 合計 ${copies.length} 筆（PI副本 ${allPICopies.length} + PO正本 ${allPOOrders.length}）`)

  // 一次撈完所有 PO sync 紀錄
  const poSyncRows = await execSQL(sql,
    `SELECT "patiscoDocId", id, status FROM "SYS_PatiscoSync" WHERE "docType" = 'PO'`
  ) as { patiscoDocId: string; id: number; status: string }[]
  const poSyncMap = new Map(poSyncRows.map(r => [r.patiscoDocId, r]))

  const PO_BUDGET_MS = 50_000
  const poStartMs = Date.now()

  for (const copy of copies) {
    if (Date.now() - poStartMs > PO_BUDGET_MS) {
      console.warn(`[patisco-po-sync] 已達時間預算，剩餘 PO 留待下次處理`)
      break
    }

    const docId: string = (copy.ID ?? copy.id ?? '').toString()
    const docNo: string = (copy.No ?? copy.no ?? '').toString()

    if (!docId) {
      console.warn('[patisco-po-sync] copy 缺少 id，略過：', JSON.stringify(copy).substring(0, 100))
      result.skipped++
      continue
    }

    // 去重（記憶體查找）
    const existing = poSyncMap.get(docId) ?? null
    if (existing?.status === 'ok' || existing?.status === 'partial') {
      result.skipped++
      continue
    }
    if (existing?.status === 'error') {
      await prisma.sYS_PatiscoSync.deleteMany({ where: { id: existing.id } })
    }

    try {
      // ── 從 listProformaInvoiceCopies header 取資料（PI 副本 = 供應商給我方的文件）──
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

      // ── 供應商比對（別名表優先，找不到則自動建立）──────────────────────────
      if (!sellerName.trim()) {
        await recordSync(sql, 'PO', docId, docNo, source, 'skipped', null, `Seller 名稱為空，略過`)
        result.skipped++
        continue
      }

      let supplierId: number | null = null
      const supplierMatch = matchSupplierWithAlias(sellerName, suppliers, aliasMap)
      if (supplierMatch === 'UNKNOWN' || (supplierMatch && supplierMatch.id === null)) {
        // 文件已確定 seller = 供應商，直接建立主檔
        const found = await prisma.sUP_Supplier.findFirst({
          where: { name: { equals: sellerName, mode: 'insensitive' } },
          select: { id: true, name: true, patiscoSupplierId: true },
        })
        const rec = found ?? await prisma.sUP_Supplier.create({ data: { name: sellerName }, select: { id: true, name: true, patiscoSupplierId: true } })
        suppliers.push(rec)
        supplierId = rec.id
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
        where: { OR: [{ patiscoOrderId: docId }, { poNo: docNo }] },
        select: { id: true },
      })

      if (!poOrder) {
        // getOrderDetail 現在已修復，可取得完整品項
        const detailRes = await getOrderDetail(creds, docId)
        const orderDetail = detailRes.ok ? extractOrderDetail(detailRes.data) : null
        const detailProducts: PatiscoOrderDetailItem[] = detailRes.ok
          ? extractDetailProducts(detailRes.data)
          : []
        const tradeTermsFromDetail = orderDetail?.payment != null
          ? parseInt(String(orderDetail.payment), 10)
          : tradeTermsCode

        // 若 getOrderDetail 回傳 seller 完整資料，更新供應商主檔（含正確名稱）
        if (orderDetail?.seller?.name) {
          await prisma.sUP_Supplier.update({
            where: { id: supplierId },
            data: {
              name:          orderDetail.seller.name,   // 用詳情的完整名稱覆蓋清單的縮寫
              ...(orderDetail.seller.address   ? { address: orderDetail.seller.address }       : {}),
              ...(orderDetail.seller.city      ? { city: orderDetail.seller.city }             : {}),
              ...(orderDetail.seller.countryCode ? { countryCode: orderDetail.seller.countryCode } : {}),
              ...(orderDetail.seller.postalCode ? { postalCode: orderDetail.seller.postalCode }  : {}),
              ...(orderDetail.seller.phoneNo   ? { phoneNo: orderDetail.seller.phoneNo }       : {}),
              ...(orderDetail.seller.email     ? { email: orderDetail.seller.email }           : {}),
              ...(orderDetail.seller.fax       ? { fax: orderDetail.seller.fax }               : {}),
              ...(orderDetail.seller.taxId     ? { taxId: orderDetail.seller.taxId }           : {}),
            },
          }).catch(() => {})
        }

        poOrder = await prisma.pO_Order.create({
          data: {
            poNo:           docNo,
            supplierId,
            status:         0,               // 草稿，等人工確認入倉
            currencyCode,
            exchangeRate:   new Decimal(1),
            sourceType:     0,               // 0 = Patisco 匯入
            patiscoOrderNo: docNo,
            patiscoOrderId: docId,
            patiscoStatus:  copy.Status ?? copy.status ?? null,
            createdBy:      systemUserId,
            items: detailProducts.length > 0 ? {
              create: (await Promise.all(detailProducts.map(async p => {
                if (!p.sku && !p.modelNo) return null
                let product = await prisma.pRD_Product.findFirst({
                  where: p.sku
                    ? { sku: p.sku, isActive: true }
                    : { modelNo: p.modelNo!, isActive: true },
                  select: { id: true, sku: true },
                })
                if (!product) {
                  product = await prisma.pRD_Product.create({
                    data: {
                      name:          p.modelNo?.trim() || p.sku || '未命名商品',
                      sku:           p.sku || null,
                      modelNo:       p.modelNo?.trim() || null,
                      specification: p.specification || null,
                      unit:          p.unit || null,
                    },
                    select: { id: true, sku: true },
                  }).catch(() => null)
                  if (!product) return null
                  console.log(`[patisco-po-sync] 自動建立商品 SKU=${p.sku} id=${product.id}`)
                }
                return {
                  productId: product.id,
                  unitPrice: new Decimal(parseFloat(String(p.price ?? '0')) || 0),
                  quantity:  parseInt(String(p.quantity ?? '0'), 10) || 0,
                  unit:      p.unit ?? null,
                  note:      p.note ?? null,
                }
              }))).filter(Boolean) as Array<{
                productId: number; unitPrice: Decimal; quantity: number; unit: string | null; note: string | null
              }>,
            } : undefined,
          },
          select: { id: true },
        })
      }

      // ── PO_SupplierPI（只有 PI copy 才建立，PO order 本身不需要）──────────
      if (copy._kind === 'pi_copy') {
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
              patiscoStatus:  copy.Status ?? copy.status ?? null,
              tradeTermsCode: tradeTermsCode != null && !isNaN(tradeTermsCode) ? tradeTermsCode : null,
              ...(patiscoCreatedAt ? { patiscoCreatedAt } : {}),
            },
          })
        }
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
// 回傳值：{ id: number } = 找到並已關聯主檔；{ id: null } = 角色已確認但尚未關聯主檔；
//         null = 名稱為空；'UNKNOWN' = 有名稱但完全未確認（需要使用者操作）

function matchCustomerWithAlias(
  buyerName: string,
  customers: Array<{ id: number; name: string; patiscoBuyerId: string | null }>,
  aliasMap: Map<string, { role: string; customerId: number | null; supplierId: number | null }>,
): { id: number } | { id: null } | null | 'UNKNOWN' {
  if (!buyerName?.trim()) return null
  const low = buyerName.trim().toLowerCase()

  // 1. 別名表：已知 CUSTOMER（無論是否已關聯主檔，都不再詢問）
  const aliasEntry = aliasMap.get(low)
  if (aliasEntry?.role === 'CUSTOMER') {
    if (aliasEntry.customerId) {
      // 驗證 customerId 確實存在於當前客戶清單，避免 stale FK 違反
      const exists = customers.find(c => c.id === aliasEntry.customerId)
      return exists ? { id: aliasEntry.customerId } : 'UNKNOWN'
    }
    return { id: null }
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
// 回傳值：{ id: number } = 找到並已關聯主檔；{ id: null } = 角色已確認但尚未關聯主檔；
//         null = 名稱為空；'UNKNOWN' = 有名稱但完全未確認（需要使用者操作）

function matchSupplierWithAlias(
  sellerName: string,
  suppliers: Array<{ id: number; name: string; patiscoSupplierId: string | null }>,
  aliasMap: Map<string, { role: string; customerId: number | null; supplierId: number | null }>,
): { id: number } | { id: null } | null | 'UNKNOWN' {
  if (!sellerName?.trim()) return null
  const low = sellerName.trim().toLowerCase()

  // 1. 別名表：已知 SUPPLIER（無論是否已關聯主檔，都不再詢問）
  const aliasEntry = aliasMap.get(low)
  if (aliasEntry?.role === 'SUPPLIER') {
    if (aliasEntry.supplierId) {
      const exists = suppliers.find(s => s.id === aliasEntry.supplierId)
      return exists ? { id: aliasEntry.supplierId } : 'UNKNOWN'
    }
    return { id: null }
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
  // patiscoProductId 備援（只在 ID 非空時才查，否則 '' 會命中所有 patiscoProductId='' 的商品）
  if (item.ID) {
    return prisma.pRD_Product.findFirst({
      where: { patiscoProductId: item.ID, isActive: true },
      select: { id: true, sku: true },
    })
  }
  return null
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

// ─── Patisco 出貨單同步（listDeliveryOrders → SLS_Shipment）──────────────────
//
// 流程：
//   1. listDeliveryOrders → 取全部出貨單清單
//   2. 每筆 getDeliveryOrderDetail(packingList) 取尺寸/重量
//      getDeliveryOrderDetail(commercialInvoice) 取單價/金額/匯率
//   3. Upsert SLS_Shipment（以 patiscoDocId 為唯一鍵）
//   4. 從 buyer.buyerId 更新 CUS_Customer.patiscoBuyerId
//   5. 建立 SLS_ShipmentItem（以 SKU 比對 PRD_Product → SLS_Item）
//   6. 建立 SLS_ShipmentPI 關聯（packings[].sourceOrderID → SLS_PI.patiscoDocId）
//   7. 寫 INV_Movement（quantity--, reservedQty--）

export async function syncPatiscoDeliveryOrders(
  source: SyncSource,
  db?: PrismaClient,
  dbUrl?: string,
  sharedCreds?: PatiscoCredentials & { _mcpUrl: string },
): Promise<SyncResult> {
  const prisma = db ?? defaultPrisma
  const resolvedDbUrl = dbUrl ?? process.env.DATABASE_URL!
  const sql = neon(resolvedDbUrl)
  const result: SyncResult = { total: 0, skipped: 0, processed: 0, errors: 0, details: [] }

  const creds = sharedCreds ?? await patiscoLogin(prisma)
  if (!creds) {
    console.warn('[patisco-do-sync] 未設定 PATISCO 帳密，跳過出貨單同步')
    return result
  }

  const systemUser = await prisma.sYS_User.findFirst({ where: { isSystem: true }, select: { id: true } })
  const systemUserId = systemUser?.id ?? 1

  // 1. 拉全部出貨單（通常不多，autoExpanded 一頁拿完）
  const allDOs: import('./client').PatiscoShipment[] = []
  let doPage = 1
  while (true) {
    const r = await listDeliveryOrders(creds, doPage)
    if (!r.ok) {
      console.error(`[patisco-do-sync] listDeliveryOrders 失敗: ${(r as { error?: string }).error}`)
      break
    }
    const items = r.data?.items ?? []
    allDOs.push(...items)
    if (!r.data?.hasNextPage || r.data?.autoExpanded) break
    doPage++
  }

  result.total = allDOs.length
  console.log(`[patisco-do-sync] listDeliveryOrders 拉到 ${allDOs.length} 筆`)

  const DO_BUDGET_MS = 45_000
  const doStartMs = Date.now()

  for (const doHeader of allDOs) {
    if (Date.now() - doStartMs > DO_BUDGET_MS) {
      console.warn(`[patisco-do-sync] 已達時間預算 ${DO_BUDGET_MS}ms，剩餘出貨單留待下次處理`)
      break
    }
    const docId = String(doHeader.id ?? '')
    const docNo = String(doHeader.no ?? '')
    console.log(`[patisco-do-sync] 處理 DO docId="${docId}" docNo="${docNo}"`)


    // 去重
    const existing = await prisma.sYS_PatiscoSync.findFirst({
      where: { docType: 'DO', patiscoDocId: docId },
      select: { id: true, status: true },
    })
    if (existing?.status === 'ok') { result.skipped++; continue }
    if (existing) await prisma.sYS_PatiscoSync.deleteMany({ where: { id: existing.id } })

    try {
      // 2. 取兩種文件詳情（CI 優先取價格，PL 取材積重量）
      // Patisco API：有些 DO 需要用 copyId 取 detail，先試 id，失敗再試 copyId
      const copyId = String(doHeader.copyId ?? '')
      const lookupId = docId

      const [ciRes, plRes] = await Promise.all([
        getDeliveryOrderDetail(creds, lookupId, 'commercialInvoice'),
        getDeliveryOrderDetail(creds, lookupId, 'packingList'),
      ])

      // Patisco API 直接回傳 detail 物件（不包在 detail/item 裡），fallback 才試 detail/item
      const extractDetail = (res: typeof ciRes) => {
        if (!res.ok || !res.data) return null
        const d = res.data
        return d.detail ?? d.item ?? (d.id ? d : null)
      }
      const ci = extractDetail(ciRes)
      const pl = extractDetail(plRes)
      console.log(`[patisco-do-sync] DO ${docNo} id=${lookupId} ciOk=${ciRes.ok} plOk=${plRes.ok} ci=${!!ci} pl=${!!pl}`)

      const detail = ci ?? pl

      if (!detail) {
        await recordSync(sql, 'DO', docId, docNo, source, 'error', null, 'getDeliveryOrderDetail 兩種文件都失敗（id 和 copyId 均無資料）')
        result.errors++
        continue
      }

      // 3. 解析欄位
      const currencyCode = (() => {
        const code = detail.currencyCode
        if (!code) return 'USD'
        const n = parseInt(String(code), 10)
        return PATISCO_CURRENCY[n] ?? 'USD'
      })()

      const shipDate = (() => {
        const sd = detail.shipDate ?? detail.createdDate ?? ''
        if (sd && sd.length >= 8) {
          return new Date(
            parseInt(sd.substring(0,4), 10),
            parseInt(sd.substring(4,6), 10) - 1,
            parseInt(sd.substring(6,8), 10),
          )
        }
        return new Date()
      })()

      const ciExchangeRate = (() => {
        const er = ci?.exchangeRate?.value
        return er ? new Decimal(er) : null
      })()

      // 4. 找客戶：優先用 buyerId（穩定唯一識別碼）
      const buyerObj = detail.buyer
      const patiscoBuyerId = buyerObj?.buyerId ?? null
      const buyerName = buyerObj?.name ?? doHeader.buyer ?? ''

      let customerId: number | null = null
      if (patiscoBuyerId) {
        const byId = await prisma.cUS_Customer.findFirst({
          where: { patiscoBuyerId },
          select: { id: true },
        })
        if (byId) {
          customerId = byId.id
        } else {
          // 先嘗試名稱比對，找到了就補 buyerId
          const byName = await prisma.cUS_Customer.findFirst({
            where: { name: { equals: buyerName, mode: 'insensitive' } },
            select: { id: true },
          })
          if (byName) {
            await prisma.cUS_Customer.update({
              where: { id: byName.id },
              data: {
                patiscoBuyerId,
                ...(buyerObj?.address  ? { address: buyerObj.address }  : {}),
                ...(buyerObj?.city     ? { city: buyerObj.city }         : {}),
                ...(buyerObj?.countryCode ? { countryCode: buyerObj.countryCode } : {}),
                ...(buyerObj?.postalCode  ? { postalCode: buyerObj.postalCode }   : {}),
                ...(buyerObj?.phoneNo  ? { phoneNo: buyerObj.phoneNo }   : {}),
                ...(buyerObj?.email    ? { email: buyerObj.email }       : {}),
                ...(buyerObj?.fax      ? { fax: buyerObj.fax }           : {}),
                ...(buyerObj?.taxId    ? { taxId: buyerObj.taxId }       : {}),
              },
            }).catch(() => {})
            customerId = byName.id
          }
        }
      }
      if (!customerId && buyerName) {
        const byName = await prisma.cUS_Customer.findFirst({
          where: { name: { equals: buyerName, mode: 'insensitive' } },
          select: { id: true },
        })
        customerId = byName?.id ?? null
      }

      // 5. Upsert SLS_Shipment
      const existingShipment = await prisma.sLS_Shipment.findFirst({
        where: { patiscoDocId: docId },
        select: { id: true },
      })

      const shipmentData = {
        shipmentNo:         docNo,
        customerId,
        currencyCode,
        actualShipDate:     shipDate,
        portOfLoading:      detail.port ?? null,
        portOfDischarge:    detail.to ?? null,
        // CI 文件的 no 就是 CI 號，PL 文件的 no 就是 PL 號
        ...(ci  ? { commercialInvNo: ci.no }  : {}),
        ...(pl  ? { packingListNo:   pl.no }   : {}),
        patiscoDocId:       docId,
        patiscoDocNo:       docNo,
        ...(ciExchangeRate ? { ciExchangeRate } : {}),
        source:             'PATISCO',
        performedBy:        systemUserId,
      }

      const shipment = existingShipment
        ? await prisma.sLS_Shipment.update({
            where: { id: existingShipment.id },
            data: shipmentData,
            select: { id: true },
          })
        : await prisma.sLS_Shipment.create({
            data: shipmentData,
            select: { id: true },
          })

      // 6. 建立 SLS_ShipmentPI 關聯
      // 策略一：從 detail.orders[]（最完整，有所有 PI 號碼）→ 用 piNo 或 patiscoDocId 查
      // 策略二：從 packings[].sourceOrderID → 用 patiscoDocId 查（補漏）
      const packingItems = (pl ?? ci)?.packings ?? []

      const linkedPiIds = new Set<number>()

      // 策略一：用 orders[].no（PI 號）找 SLS_PI
      const ordersList = detail.orders ?? []
      for (const ord of ordersList) {
        const piNo = ord.no?.trim()
        const srcId = ord.id?.trim()
        if (!piNo && !srcId) continue
        const pi = await prisma.sLS_PI.findFirst({
          where: piNo
            ? { OR: [{ piNo }, ...(srcId ? [{ patiscoDocId: srcId }] : [])] }
            : { patiscoDocId: srcId! },
          select: { id: true },
        })
        if (pi) linkedPiIds.add(pi.id)
      }

      // 策略二：從 packings[].sourceOrderID 補漏（有時 orders[] 不完整）
      for (const p of packingItems) {
        const sid = (p as { sourceOrderID?: string }).sourceOrderID
        if (!sid) continue
        const pi = await prisma.sLS_PI.findFirst({
          where: { patiscoDocId: sid },
          select: { id: true },
        })
        if (pi) linkedPiIds.add(pi.id)
      }

      for (const piId of Array.from(linkedPiIds)) {
        await prisma.sLS_ShipmentPI.upsert({
          where: { shipmentId_piId: { shipmentId: shipment.id, piId } },
          create: { shipmentId: shipment.id, piId },
          update: {},
        })
      }

      console.log(`[patisco-do-sync] DO ${docNo} 關聯 PI 數量: ${linkedPiIds.size}（orders=${ordersList.length} packingSrcIds=${new Set(packingItems.map(p => (p as {sourceOrderID?:string}).sourceOrderID).filter(Boolean)).size}）`)

      // 7. 重建 SLS_ShipmentItem（以 Patisco 為準，全刪重建同一張出貨單範圍內的品項）
      // 箱號、數量等欄位在 Patisco 端可變動（跳號、修正），每次同步以 Patisco 資料覆蓋
      // INV_Movement 只在首次建立（isNewShipment），避免重複扣庫存
      const isNewShipment = !existingShipment
      if (packingItems.length > 0) {
        await prisma.sLS_ShipmentItem.deleteMany({ where: { shipmentId: shipment.id } })
        for (const packing of packingItems) {
          const sku = packing.sku?.trim()
          if (!sku) continue

          const product = await prisma.pRD_Product.findFirst({
            where: { sku, isActive: true },
            select: { id: true },
          })
          if (!product) continue

          // 找對應的 SLS_Item（從 sourceOrderID 或 sourceOrderNo 關聯的 SLS_Order）
          const packingSrcOrderId = (packing as { sourceOrderID?: string }).sourceOrderID
          const packingSrcOrderNo = (packing as { sourceOrderNo?: string }).sourceOrderNo
          const sourcePI = packingSrcOrderId || packingSrcOrderNo
            ? await prisma.sLS_PI.findFirst({
                where: {
                  OR: [
                    ...(packingSrcOrderId ? [{ patiscoDocId: packingSrcOrderId }] : []),
                    ...(packingSrcOrderNo ? [{ piNo: packingSrcOrderNo }] : []),
                  ],
                },
                select: { orderId: true },
              })
            : null

          const slsItem = sourcePI
            ? await prisma.sLS_Item.findFirst({
                where: { orderId: sourcePI.orderId, productId: product.id },
                select: { id: true },
              })
            : null

          const qty = parseInt(String((packing as { quantity?: string }).quantity ?? '0'), 10) || 0
          if (qty === 0) continue

          // PL 版的 packing 有重量/材積欄位
          type PLPacking = import('./client').PatiscoShipmentPackingPL
          const plItem = pl?.packings?.find(p => {
            const pp = p as PLPacking
            return pp.sourceProductID === (packing as PLPacking).sourceProductID
              && pp.sourceOrderID === (packing as PLPacking).sourceOrderID
          }) as PLPacking | undefined

          const grossWt   = plItem?.totalGrossWeight ?? plItem?.grossWeight ?? null
          const netWt     = plItem?.totalNetWeight   ?? plItem?.netWeight   ?? null
          const totalFt3  = plItem?.totalDimension ?? plItem?.imperialTotalDimension ?? null  // Patisco 回傳 ft³
          const FT3_TO_M3 = new Decimal('0.028317')
          const cubicFt   = totalFt3 ? new Decimal(totalFt3) : null
          const cbm       = cubicFt  ? cubicFt.mul(FT3_TO_M3).toDecimalPlaces(6) : null

          // 直接用 quantityOfCartons（Patisco 已算好），fallback 才自己除
          const cartonsRaw = plItem?.quantityOfCartons
            ? parseInt(String(plItem.quantityOfCartons), 10)
            : null
          const unitsPerCarton = plItem?.unitPerCarton
            ? parseInt(String(plItem.unitPerCarton), 10)
            : null
          const cartons = cartonsRaw
            ?? (unitsPerCarton && unitsPerCarton > 0 ? Math.floor(qty / unitsPerCarton) : null)

          // 箱號範圍：從 caseNumbers 陣列提取（每個 PI 從 1 起算）
          const caseNums = (plItem as import('./client').PatiscoShipmentPackingPL)?.caseNumbers ?? []
          let cartonNoFrom: string | null = null
          let cartonNoTo:   string | null = null
          if (caseNums.length > 0) {
            const first = caseNums[0]
            const last  = caseNums[caseNums.length - 1]
            cartonNoFrom = first.caseNo1 ?? null
            cartonNoTo   = last.caseNo1  ?? null
          }

          // 找來源 PI ID
          const srcOrderId = (packing as { sourceOrderID?: string }).sourceOrderID
          const srcOrderNo = (packing as { sourceOrderNo?: string }).sourceOrderNo
          const srcPI = srcOrderId || srcOrderNo
            ? await prisma.sLS_PI.findFirst({
                where: {
                  OR: [
                    ...(srcOrderId ? [{ patiscoDocId: srcOrderId }] : []),
                    ...(srcOrderNo ? [{ piNo: srcOrderNo }] : []),
                  ],
                },
                select: { id: true },
              })
            : null

          await prisma.sLS_ShipmentItem.create({
            data: {
              shipmentId:    shipment.id,
              slsItemId:     slsItem?.id ?? null,
              piId:          srcPI?.id   ?? null,
              quantity:      qty,
              cartons,
              cartonNoFrom,
              cartonNoTo,
              grossWeightKg: grossWt ? new Decimal(grossWt) : null,
              netWeightKg:   netWt   ? new Decimal(netWt)   : null,
              cubicFt,
              cbm,
            },
          })

          // INV_Movement: 出貨 → quantity--, reservedQty--（只在首次建立，避免重複扣庫存）
          if (isNewShipment) {
            const stock = await prisma.iNV_Stock.findUnique({
              where: { productId: product.id },
              select: { quantity: true, reservedQty: true },
            })
            if (stock) {
              const qtyAfter      = stock.quantity    - qty
              const reservedAfter = Math.max(0, stock.reservedQty - qty)
              await prisma.iNV_Stock.update({
                where: { productId: product.id },
                data: { quantity: qtyAfter, reservedQty: reservedAfter },
              })
              await prisma.iNV_Movement.create({
                data: {
                  productId:      product.id,
                  type:           4,  // 4 = 出貨確認
                  qtyDelta:       -qty,
                  reservedDelta:  -Math.min(qty, stock.reservedQty),
                  quantityAfter:  qtyAfter,
                  reservedAfter,
                  slsShipmentId:  shipment.id,
                  performedBy:    systemUserId,
                  source:         'PATISCO',
                  note:           `Patisco DO ${docNo}`,
                },
              })
            }
          }
        }
      }

      await recordSync(sql, 'DO', docId, docNo, source, 'ok',
        { customerId, itemCount: packingItems.length }, null)
      result.processed++
      result.details.push({
        patiscoDocNo: docNo,
        status: 'ok',
        msg: `客戶: ${buyerName}，${packingItems.length} 項商品`,
      })

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[patisco-do-sync] 處理 DO ${docNo} 失敗`, err)
      await recordSync(sql, 'DO', docId, docNo, source, 'error', null, msg)
      result.errors++
      result.details.push({ patiscoDocNo: docNo, status: 'error', msg })
    }
  }

  console.log(`[patisco-do-sync] 完成 processed=${result.processed} skipped=${result.skipped} errors=${result.errors}`)
  return result
}

// ─── 補建出貨單 ↔ PI 關聯（針對歷史資料） ───────────────────────────────────

export async function backfillShipmentPILinks(
  source: SyncSource,
  db?: PrismaClient,
): Promise<{ fixed: number; failed: number; details: Array<{ shipmentNo: string; status: string; msg?: string }> }> {
  const prisma = db ?? defaultPrisma
  const result = { fixed: 0, failed: 0, details: [] as Array<{ shipmentNo: string; status: string; msg?: string }> }

  const creds = await patiscoLogin(prisma)
  if (!creds) return result

  const shipments = await prisma.sLS_Shipment.findMany({
    where: { pis: { none: {} }, patiscoDocId: { not: null }, source: 'PATISCO' },
    select: { id: true, shipmentNo: true, patiscoDocId: true },
    orderBy: { id: 'asc' },
  })

  for (const s of shipments) {
    const docId = s.patiscoDocId!
    try {
      const [ciRes, plRes] = await Promise.all([
        getDeliveryOrderDetail(creds, docId, 'commercialInvoice'),
        getDeliveryOrderDetail(creds, docId, 'packingList'),
      ])
      const extractDetail = (res: typeof ciRes) => {
        if (!res.ok || !res.data) return null
        const d = res.data as Record<string, unknown>
        return (d.detail ?? d.item ?? (d.id ? d : null)) as Record<string, unknown> | null
      }
      const ci = extractDetail(ciRes)
      const pl = extractDetail(plRes)
      const detail = ci ?? pl

      if (!detail) {
        result.failed++
        result.details.push({ shipmentNo: s.shipmentNo, status: 'error', msg: 'getDeliveryOrderDetail 無資料' })
        continue
      }

      const ordersList = (detail.orders ?? []) as Array<{ no?: string; id?: string }>
      const packingItems = ((pl ?? ci)?.packings ?? []) as Array<{ sourceOrderID?: string }>

      const linkedPiIds = new Set<number>()

      for (const ord of ordersList) {
        const piNo = ord.no?.trim()
        const srcId = ord.id?.trim()
        if (!piNo && !srcId) continue
        const pi = await prisma.sLS_PI.findFirst({
          where: piNo
            ? { OR: [{ piNo }, ...(srcId ? [{ patiscoDocId: srcId }] : [])] }
            : { patiscoDocId: srcId! },
          select: { id: true },
        })
        if (pi) linkedPiIds.add(pi.id)
      }

      for (const p of packingItems) {
        const sid = (p as Record<string, unknown>).sourceOrderID as string | undefined
        if (!sid) continue
        const pi = await prisma.sLS_PI.findFirst({
          where: { patiscoDocId: sid },
          select: { id: true },
        })
        if (pi) linkedPiIds.add(pi.id)
      }

      if (linkedPiIds.size === 0) {
        result.failed++
        result.details.push({ shipmentNo: s.shipmentNo, status: 'not_found', msg: 'Patisco detail 中無關聯 PI' })
        continue
      }

      for (const piId of Array.from(linkedPiIds)) {
        await prisma.sLS_ShipmentPI.upsert({
          where: { shipmentId_piId: { shipmentId: s.id, piId } },
          create: { shipmentId: s.id, piId },
          update: {},
        })
      }
      result.fixed++
      result.details.push({ shipmentNo: s.shipmentNo, status: 'ok', msg: `關聯 ${linkedPiIds.size} 個 PI` })
    } catch (err) {
      result.failed++
      result.details.push({ shipmentNo: s.shipmentNo, status: 'error', msg: err instanceof Error ? err.message : String(err) })
    }
  }

  return result
}
