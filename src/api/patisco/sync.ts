/**
 * Patisco 同步主程式 — 兩階段設計
 *
 * Phase 1：從 Patisco API 拉所有 raw data → 存入 SYS_PatiscoSync
 * Phase 2：解析 raw data → 依序寫入 PAXIS 業務表
 *
 * 執行順序（Phase 2）：
 *   Step 1: 客戶主檔 (CUS_Customer)   ← 從 PO_COPY 的 buyer
 *   Step 2: 供應商主檔 (SUP_Supplier) ← 從 PI_COPY 的 seller
 *   Step 3: 產品主檔 (PRD_Product)    ← 所有文件的 SKU（只存基本資料，不存價格）
 *   Step 4: 銷售訂單 (SLS_Order)      ← 從 PO_COPY
 *   Step 5: 採購訂單 (PO_Order)       ← 從 PO，嘗試連結 SLS_Order
 *   Step 6: 供應商 PI (PO_SupplierPI) ← 從 PI_COPY，連結 PO_Order
 *   Step 7: 我方 PI (SLS_PI)          ← 從 PI，連結 SLS_Order（含客戶賣價）
 *   Step 8: 出貨單 (SLS_Shipment)     ← 從 DO，只連 SLS_PI，不連 PO
 */

import type { PrismaClient } from '@prisma/client'
import {
  patiscoLogin,
  listPurchaseOrderCopies,
  listPurchaseOrders,
  listProformaInvoiceCopies,
  listProformaInvoices,
  listDeliveryOrders,
  getOrderCopyDetail,
  getOrderCopyProducts,
  getOrderDetail,
  getDeliveryOrderDetail,
  extractOrderDetail,
  resolvePatiscoCurrency,
  type PatiscoCredentials,
  type PatiscoOrderCopyDetail,
  type PatiscoOrderCopyProduct,
  type PatiscoOrderDetailItem,
  type PatiscoShipmentDetail,
} from './client'

// ─── 常數 ────────────────────────────────────────────────────────────────────

const SYS_USER_ID = 1  // 系統帳號 ID（Patisco 自動觸發用）

// 我方公司關鍵字（phase2ParseAll 啟動時從 SYS_Company 動態載入，fallback 到空陣列）
let SELF_COMPANY_KEYWORDS: string[] = []

// ─── 型別 ────────────────────────────────────────────────────────────────────

export type PIConflictRecord = {
  docId: string
  buyerName: string | null
  date: string | null
  amount: string | null
  products: Array<{
    sku: string
    modelNo: string | null
    specification: string | null
    quantity: string | null
    price: string | null
    unit: string | null
  }>
}

export type PIConflict = {
  piNo: string
  records: PIConflictRecord[]
}

export type SyncStepResult = {
  created: number
  updated: number
  skipped: number
  errors: string[]
  conflicts?: PIConflict[]
}

export type SyncResult = {
  jobId: number
  status: 'completed' | 'error' | 'cancelled'
  phase1: { total: number; done: number; errors: string[] }
  phase2: Record<string, SyncStepResult>
  errorMsg?: string
}

type RawSyncRecord = {
  id: number
  docType: string
  patiscoDocId: string
  patiscoDocNo: string
  result: unknown
}

// ─── 工具函式 ────────────────────────────────────────────────────────────────

/** Patisco YYYYMMDDHHmmss → Date，解析失敗回傳 null */
function parsePatiscoDate(s?: string | null): Date | null {
  if (!s || s.length < 8) return null
  const clean = s.replace(/\D/g, '')
  if (clean.length < 8) return null
  const y = parseInt(clean.slice(0, 4))
  const mo = parseInt(clean.slice(4, 6)) - 1
  const d = parseInt(clean.slice(6, 8))
  const h = clean.length >= 10 ? parseInt(clean.slice(8, 10)) : 0
  const mi = clean.length >= 12 ? parseInt(clean.slice(10, 12)) : 0
  const sec = clean.length >= 14 ? parseInt(clean.slice(12, 14)) : 0
  const dt = new Date(y, mo, d, h, mi, sec)
  return isNaN(dt.getTime()) ? null : dt
}

/** 判斷某個名稱是否為我方公司 */
function isSelf(name?: string | null): boolean {
  if (!name) return false
  const lower = name.toLowerCase()
  return SELF_COMPANY_KEYWORDS.some(kw => lower.includes(kw))
}

/** 安全取得 Decimal 字串 */
function toDecimal(v?: string | number | null): string {
  if (v == null || v === '') return '0'
  const n = parseFloat(String(v))
  return isNaN(n) ? '0' : String(n)
}

/** 安全取整數 */
function toInt(v?: string | number | null): number {
  if (v == null) return 0
  const n = parseInt(String(v), 10)
  return isNaN(n) ? 0 : n
}

/** 全頁分頁拉清單 */
async function fetchAllPages<T>(
  listFn: (page: number) => Promise<{ ok: boolean; data?: { items: T[]; hasNextPage: boolean } | null; error?: string }>,
): Promise<T[]> {
  const all: T[] = []
  let page = 1
  while (true) {
    const r = await listFn(page)
    if (!r.ok || !r.data) break
    all.push(...(r.data.items ?? []))
    if (!r.data.hasNextPage) break
    page++
  }
  return all
}

/** 分頁拉 copy products，直到拿完 */
async function fetchAllCopyProducts(
  creds: PatiscoCredentials,
  copyId: string,
): Promise<PatiscoOrderCopyProduct[]> {
  const all: PatiscoOrderCopyProduct[] = []
  let page = 1
  while (true) {
    const r = await getOrderCopyProducts(creds, copyId, page)
    if (!r.ok || !r.data) break
    all.push(...(r.data.items ?? []))
    if (!r.data.hasNextPage) break
    page++
  }
  return all
}

// ─── Phase 1 detail fetchers ─────────────────────────────────────────────────

async function fetchDetailForCopy(creds: PatiscoCredentials, item: Record<string, unknown>) {
  const id = String(item.ID ?? item.id ?? item.copyId ?? '')
  // List item 本身已有 Seller/Buyer 字串（不需要依賴 getOrderCopyDetail.detail）
  const sellerName = String(item.Seller ?? item.seller ?? '').trim() || null
  const buyerName  = String(item.Buyer  ?? item.buyer  ?? '').trim() || null
  const products = await fetchAllCopyProducts(creds, id)
  return { sellerName, buyerName, products }
}

async function fetchDetailForOrder(creds: PatiscoCredentials, item: Record<string, unknown>) {
  const id = String(item.id ?? item.ID ?? '')
  const r = await getOrderDetail(creds, id)
  if (!r.ok || !r.data) return null
  const header = extractOrderDetail(r.data)
  const products: PatiscoOrderDetailItem[] = r.data.products?.items ?? []
  if (r.data.products?.hasNextPage) {
    console.warn(`[patisco-sync] Order ${id} has >25 products, only first page fetched`)
  }
  return { header, products, priceAdjustments: r.data.priceAdjustments ?? [], price: r.data.price ?? null }
}

async function fetchDetailForDO(creds: PatiscoCredentials, item: Record<string, unknown>) {
  const id = String(item.id ?? item.ID ?? '')
  const [plR, ciR] = await Promise.all([
    getDeliveryOrderDetail(creds, id, 'packingList'),
    getDeliveryOrderDetail(creds, id, 'commercialInvoice'),
  ])
  const pl = plR.ok ? (plR.data?.detail ?? plR.data ?? null) : null
  const ci = ciR.ok ? (ciR.data?.detail ?? ciR.data ?? null) : null
  return { packingList: pl, commercialInvoice: ci }
}

// ─── Phase 1：拉所有 raw data ────────────────────────────────────────────────

type DocType = 'PO_COPY' | 'PO' | 'PI_COPY' | 'PI' | 'DO'

const DOC_CONFIGS: Array<{
  docType: DocType
  listFn: (creds: PatiscoCredentials, page: number) => Promise<{ ok: boolean; data?: { items: Record<string, unknown>[]; hasNextPage: boolean } | null }>
  getIdNo: (item: Record<string, unknown>) => { id: string; no: string }
  fetchDetail: (creds: PatiscoCredentials, item: Record<string, unknown>) => Promise<unknown>
}> = [
  {
    docType: 'PO_COPY',
    listFn: (c, p) => listPurchaseOrderCopies(c, p) as ReturnType<typeof listPurchaseOrderCopies>,
    getIdNo: (i) => ({ id: String(i.ID ?? i.id ?? ''), no: String(i.No ?? i.no ?? '') }),
    fetchDetail: fetchDetailForCopy,
  },
  {
    docType: 'PO',
    listFn: (c, p) => listPurchaseOrders(c, p) as ReturnType<typeof listPurchaseOrders>,
    getIdNo: (i) => ({ id: String(i.ID ?? i.id ?? ''), no: String(i.No ?? i.no ?? '') }),
    fetchDetail: fetchDetailForOrder,
  },
  {
    docType: 'PI_COPY',
    listFn: (c, p) => listProformaInvoiceCopies(c, p) as ReturnType<typeof listProformaInvoiceCopies>,
    getIdNo: (i) => ({ id: String(i.ID ?? i.id ?? ''), no: String(i.No ?? i.no ?? '') }),
    fetchDetail: fetchDetailForCopy,
  },
  {
    docType: 'PI',
    listFn: (c, p) => listProformaInvoices(c, p) as ReturnType<typeof listProformaInvoices>,
    getIdNo: (i) => ({ id: String(i.id ?? i.ID ?? ''), no: String(i.no ?? i.No ?? '') }),
    fetchDetail: fetchDetailForOrder,
  },
  {
    docType: 'DO',
    listFn: (c, p) => listDeliveryOrders(c, p) as ReturnType<typeof listDeliveryOrders>,
    getIdNo: (i) => ({ id: String(i.id ?? i.ID ?? ''), no: String(i.no ?? i.No ?? '') }),
    fetchDetail: fetchDetailForDO,
  },
]

export async function phase1FetchAll(
  prisma: PrismaClient,
  creds: PatiscoCredentials,
  jobId: number,
): Promise<{ total: number; done: number; errors: string[] }> {
  const errors: string[] = []
  let total = 0
  let done = 0

  const CONCURRENCY = 5  // 同時最多 5 個 Patisco detail API 請求

  for (const cfg of DOC_CONFIGS) {
    const items = await fetchAllPages<Record<string, unknown>>(
      (page) => cfg.listFn(creds, page),
    )
    total += items.length
    console.log(`[phase1] ${cfg.docType}: ${items.length} items`)

    // 先批次查增量狀態，避免每筆單獨 DB roundtrip
    const ids = items.map(item => cfg.getIdNo(item).id).filter(Boolean)
    const existingRecords = await prisma.sYS_PatiscoSync.findMany({
      where: { docType: cfg.docType, patiscoDocId: { in: ids } },
      select: { patiscoDocId: true, patiscoModifiedAt: true },
    })
    const existingMap = new Map(existingRecords.map(r => [r.patiscoDocId, r.patiscoModifiedAt]))

    // 過濾出需要更新的項目
    const itemsToFetch = items.filter(item => {
      const { id } = cfg.getIdNo(item)
      if (!id) return false
      const patiscoModifiedAt = parsePatiscoDate(
        String(item.LastModifiedDate ?? item.lastModifiedDate ?? item.CreatedDate ?? item.createdDate ?? ''),
      )
      const existingModifiedAt = existingMap.get(id)
      if (existingModifiedAt && patiscoModifiedAt && patiscoModifiedAt <= existingModifiedAt) {
        done++
        return false
      }
      return true
    })

    console.log(`[phase1] ${cfg.docType}: ${itemsToFetch.length} to fetch (${items.length - itemsToFetch.length} skipped)`)

    // 並發抓 detail，最多 CONCURRENCY 個同時跑
    for (let i = 0; i < itemsToFetch.length; i += CONCURRENCY) {
      const batch = itemsToFetch.slice(i, i + CONCURRENCY)
      await Promise.all(batch.map(async (item) => {
        const { id, no } = cfg.getIdNo(item)
        const patiscoModifiedAt = parsePatiscoDate(
          String(item.LastModifiedDate ?? item.lastModifiedDate ?? item.CreatedDate ?? item.createdDate ?? ''),
        )
        try {
          const detail = await cfg.fetchDetail(creds, item)
          await prisma.sYS_PatiscoSync.upsert({
            where: { docType_patiscoDocId: { docType: cfg.docType, patiscoDocId: id } },
            create: {
              docType: cfg.docType,
              patiscoDocId: id,
              patiscoDocNo: no,
              source: 'manual',
              status: 'ok',
              result: detail as object,
              syncJobId: jobId,
              patiscoModifiedAt: patiscoModifiedAt ?? undefined,
            },
            update: {
              patiscoDocNo: no,
              status: 'ok',
              result: detail as object,
              syncedAt: new Date(),
              syncJobId: jobId,
              patiscoModifiedAt: patiscoModifiedAt ?? undefined,
              errorMsg: null,
            },
          })
          done++
        } catch (e) {
          const msg = `${cfg.docType}/${id}: ${e instanceof Error ? e.message : String(e)}`
          errors.push(msg)
          await prisma.sYS_PatiscoSync.upsert({
            where: { docType_patiscoDocId: { docType: cfg.docType, patiscoDocId: id } },
            create: {
              docType: cfg.docType,
              patiscoDocId: id,
              patiscoDocNo: no,
              source: 'manual',
              status: 'error',
              syncJobId: jobId,
              errorMsg: msg,
            },
            update: { status: 'error', syncJobId: jobId, errorMsg: msg },
          })
        }
      }))

      // 每批次更新進度
      await prisma.sYS_SyncJob.update({
        where: { id: jobId },
        data: { phase1Total: total, phase1Done: done },
      })
    }
  }

  await prisma.sYS_SyncJob.update({
    where: { id: jobId },
    data: { phase1Total: total, phase1Done: done },
  })

  return { total, done, errors }
}

// ─── Phase 2 helpers ──────────────────────────────────────────────────────────

function getRawRecords(prisma: PrismaClient, docType: string): Promise<RawSyncRecord[]> {
  return prisma.sYS_PatiscoSync.findMany({
    where: { docType, status: 'ok' },
    select: { id: true, docType: true, patiscoDocId: true, patiscoDocNo: true, result: true },
  }) as Promise<RawSyncRecord[]>
}

async function setPhase2Step(prisma: PrismaClient, jobId: number, step: string) {
  await prisma.sYS_SyncJob.update({ where: { id: jobId }, data: { phase2Step: step } })
  console.log(`[phase2] step: ${step}`)
}

// ─── Step 1：客戶主檔 ─────────────────────────────────────────────────────────

export async function step1_customers(prisma: PrismaClient, jobId: number): Promise<SyncStepResult> {
  const r: SyncStepResult = { created: 0, updated: 0, skipped: 0, errors: [] }

  type BuyerInfo = {
    name: string
    address?: string; city?: string; countryCode?: string; postalCode?: string
    phoneNo?: string; email?: string; fax?: string; taxId?: string
    currencyCode?: string
  }
  const customerMap = new Map<string, BuyerInfo>()

  // 從 PI 取客戶：seller=我方，buyer=客戶
  const piRecords = await getRawRecords(prisma, 'PI')
  for (const rec of piRecords) {
    const raw = rec.result as { header?: Record<string, unknown> }
    const h = raw?.header as Record<string, unknown> | undefined
    if (!h || !isSelf((h.seller as { name?: string } | undefined)?.name)) continue
    const buyer = h.buyer as { name?: string; address?: string; city?: string; countryCode?: string; postalCode?: string; phoneNo?: string; email?: string; fax?: string; taxId?: string } | undefined
    const name = buyer?.name?.trim()
    if (!name) continue
    if (!customerMap.has(name)) {
      customerMap.set(name, {
        name,
        address: buyer?.address ?? undefined,
        city: buyer?.city ?? undefined,
        countryCode: buyer?.countryCode ?? undefined,
        postalCode: buyer?.postalCode ?? undefined,
        phoneNo: buyer?.phoneNo ?? undefined,
        email: buyer?.email ?? undefined,
        fax: buyer?.fax ?? undefined,
        taxId: buyer?.taxId ?? undefined,
        currencyCode: resolvePatiscoCurrency((h.currencyCode as string | undefined)),
      })
    }
  }

  // 從 PO_COPY 補充（可能有不同客戶）
  const copyRecords = await getRawRecords(prisma, 'PO_COPY')
  for (const rec of copyRecords) {
    const raw = rec.result as { buyerName?: string | null }
    const name = raw?.buyerName?.trim()
    if (name && !customerMap.has(name)) customerMap.set(name, { name })
  }

  for (const info of Array.from(customerMap.values())) {
    try {
      const existing = await prisma.cUS_Customer.findFirst({ where: { name: info.name }, select: { id: true } })
      if (existing) { r.skipped++; continue }
      await prisma.cUS_Customer.create({
        data: {
          name: info.name,
          address: info.address,
          city: info.city,
          countryCode: info.countryCode,
          postalCode: info.postalCode,
          phoneNo: info.phoneNo,
          email: info.email,
          fax: info.fax,
          taxId: info.taxId,
          currencyCode: info.currencyCode ?? 'USD',
          syncJobId: jobId,
        },
      })
      r.created++
    } catch (e) {
      r.errors.push(`customer "${info.name}": ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return r
}

// ─── Step 2：供應商主檔 ────────────────────────────────────────────────────────

export async function step2_suppliers(prisma: PrismaClient, jobId: number): Promise<SyncStepResult> {
  const r: SyncStepResult = { created: 0, updated: 0, skipped: 0, errors: [] }

  // 收集供應商名稱：來自 PO（我方 buyer，seller 是供應商）+ PI_COPY（我方 buyer，seller 是供應商）
  const supplierNames = new Set<string>()

  type SellerInfo = {
    name: string
    address?: string; city?: string; countryCode?: string; postalCode?: string
    phoneNo?: string; email?: string; fax?: string; taxId?: string
    currencyCode?: string
  }
  const supplierMap = new Map<string, SellerInfo>()

  const poRecords = await getRawRecords(prisma, 'PO')
  for (const rec of poRecords) {
    const raw = rec.result as { header?: Record<string, unknown> }
    const h = raw?.header as Record<string, unknown> | undefined
    if (!h || !isSelf((h.buyer as { name?: string } | undefined)?.name)) continue
    const seller = h.seller as { name?: string; address?: string; city?: string; countryCode?: string; postalCode?: string; phoneNo?: string; email?: string; fax?: string; taxId?: string } | undefined
    const name = seller?.name?.trim()
    if (!name) continue
    if (!supplierMap.has(name)) {
      supplierMap.set(name, {
        name,
        address: seller?.address ?? undefined,
        city: seller?.city ?? undefined,
        countryCode: seller?.countryCode ?? undefined,
        postalCode: seller?.postalCode ?? undefined,
        phoneNo: seller?.phoneNo ?? undefined,
        email: seller?.email ?? undefined,
        fax: seller?.fax ?? undefined,
        taxId: seller?.taxId ?? undefined,
        currencyCode: resolvePatiscoCurrency((h.currencyCode as string | undefined)),
      })
    }
  }

  const copyRecords = await getRawRecords(prisma, 'PI_COPY')
  for (const rec of copyRecords) {
    const raw = rec.result as { sellerName?: string | null }
    const name = raw?.sellerName?.trim()
    if (name && !supplierMap.has(name)) supplierMap.set(name, { name })
  }

  for (const info of Array.from(supplierMap.values())) {
    try {
      const existing = await prisma.sUP_Supplier.findFirst({ where: { name: info.name }, select: { id: true } })
      if (existing) { r.skipped++; continue }
      await prisma.sUP_Supplier.create({
        data: {
          name: info.name,
          address: info.address,
          city: info.city,
          countryCode: info.countryCode,
          postalCode: info.postalCode,
          phoneNo: info.phoneNo,
          email: info.email,
          fax: info.fax,
          taxId: info.taxId,
          currencyCode: info.currencyCode ?? 'TWD',
          syncJobId: jobId,
        },
      })
      r.created++
    } catch (e) {
      r.errors.push(`supplier "${info.name}": ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return r
}

// ─── Step 3：產品主檔 ─────────────────────────────────────────────────────────

export async function step3_products(prisma: PrismaClient, jobId: number): Promise<SyncStepResult> {
  const r: SyncStepResult = { created: 0, updated: 0, skipped: 0, errors: [] }

  // 從所有文件收集 SKU（只存基本資料，不存價格；品名留空由 AI 事後從規格產生）
  const skuMap = new Map<string, { modelNo?: string; spec?: string; unit?: string }>()

  for (const docType of ['PO_COPY', 'PO', 'PI_COPY', 'PI', 'DO'] as DocType[]) {
    const records = await getRawRecords(prisma, docType)
    for (const rec of records) {
      const raw = rec.result as Record<string, unknown>
      let items: Array<{ sku?: string; modelNo?: string; specification?: string; unit?: string }> = []

      if (docType === 'DO') {
        const pl = raw.packingList as PatiscoShipmentDetail | null
        items = (pl?.packings ?? []) as typeof items
      } else {
        items = ((raw.products as unknown[]) ?? []) as typeof items
      }

      for (const item of items) {
        const sku = item.sku?.trim()
        if (!sku || skuMap.has(sku)) continue
        skuMap.set(sku, {
          modelNo: item.modelNo?.trim(),
          spec: item.specification?.trim(),
          unit: item.unit?.trim(),
        })
      }
    }
  }

  for (const [sku, info] of Array.from(skuMap)) {
    try {
      const existing = await prisma.pRD_Product.findUnique({
        where: { sku },
        select: { id: true, nameNeedsAI: true },
      })

      if (existing) {
        // 若品名仍是 AI 待處理（nameNeedsAI=true），補上 modelNo 作為暫代值
        if (existing.nameNeedsAI && info.modelNo) {
          await prisma.pRD_Product.update({
            where: { id: existing.id },
            data: { name: info.modelNo, modelNo: info.modelNo },
          })
          r.updated++
        } else {
          r.skipped++
        }
        continue
      }

      await prisma.pRD_Product.create({
        data: {
          sku,
          name: info.modelNo ?? sku,  // 暫代，nameNeedsAI=true 標記待 AI 從規格產生正式品名
          nameNeedsAI: true,
          modelNo: info.modelNo ?? undefined,
          specification: info.spec ?? undefined,
          unit: info.unit ?? undefined,
          syncJobId: jobId,
        },
      })
      r.created++
    } catch (e) {
      r.errors.push(`SKU ${sku}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return r
}

// ─── Step 4：SLS_Order ────────────────────────────────────────────────────────

export async function step4_slsOrders(prisma: PrismaClient, jobId: number): Promise<SyncStepResult> {
  const r: SyncStepResult = { created: 0, updated: 0, skipped: 0, errors: [] }
  const records = await getRawRecords(prisma, 'PO_COPY')

  for (const rec of records) {
    try {
      const raw = rec.result as { sellerName?: string | null; buyerName?: string | null; products?: PatiscoOrderCopyProduct[] }
      const buyerName = raw?.buyerName?.trim()
      // PO_COPY = 客戶 PO 副本寄給我方（我方是 seller），buyerName 是客戶名稱
      if (!buyerName) { r.skipped++; continue }

      const orderNo = rec.patiscoDocNo?.trim() || rec.patiscoDocId
      if (!orderNo) { r.skipped++; continue }

      const existing = await prisma.sLS_Order.findUnique({
        where: { orderNo },
        select: { id: true, source: true },
      })
      if (existing) {
        if (existing.source === 'PATISCO') {
          await prisma.sLS_Order.update({
            where: { orderNo },
            data: { patiscoDocId: rec.patiscoDocId },
          })
          r.updated++
        } else {
          r.skipped++  // 人工建立，不動
        }
        continue
      }

      const customer = buyerName
        ? await prisma.cUS_Customer.findFirst({ where: { name: buyerName }, select: { id: true } })
        : null

      const order = await prisma.sLS_Order.create({
        data: {
          orderNo,
          customerId: customer?.id ?? undefined,
          status: 1,
          currencyCode: 'USD',
          exchangeRate: 1,
          orderDate: new Date(),
          source: 'PATISCO',
          patiscoBuyerName: buyerName ?? undefined,
          patiscoDocId: rec.patiscoDocId,
          patiscoDocNo: rec.patiscoDocNo,
          syncJobId: jobId,
          createdBy: SYS_USER_ID,
          performedBy: null,
        },
      })

      for (const p of (raw.products ?? [])) {
        const sku = p.sku?.trim()
        if (!sku) continue
        const product = await prisma.pRD_Product.findUnique({ where: { sku }, select: { id: true } })
        if (!product) continue

        await prisma.sLS_Item.create({
          data: {
            orderId: order.id,
            productId: product.id,
            unitPrice: toDecimal(p.price),
            quantity: toInt(p.quantity),
            unit: p.unit?.trim() ?? undefined,
            productNameSnapshot: p.specification?.trim() || p.modelNo?.trim() || undefined,
            customerSkuRef: sku,
          },
        })
      }
      r.created++
    } catch (e) {
      r.errors.push(`PO_COPY ${rec.patiscoDocId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return r
}

// ─── Step 5：PO_Order ─────────────────────────────────────────────────────────

export async function step5_poOrders(prisma: PrismaClient, jobId: number): Promise<SyncStepResult> {
  const r: SyncStepResult = { created: 0, updated: 0, skipped: 0, errors: [] }
  const records = await getRawRecords(prisma, 'PO')

  for (const rec of records) {
    try {
      const raw = rec.result as {
        header?: ReturnType<typeof extractOrderDetail>
        products?: PatiscoOrderDetailItem[]
        price?: { amount?: string } | null
      }
      const header = raw?.header
      if (!header) { r.skipped++; continue }

      // 我方 PO：buyer = 我方，seller = 供應商
      if (!isSelf(header.buyer?.name)) {
        console.warn(`[step5] PO ${rec.patiscoDocId} buyer 不是我方: ${header.buyer?.name}`)
        r.skipped++; continue
      }

      const poNo = rec.patiscoDocNo.trim() || rec.patiscoDocId
      const supplierName = header.seller?.name?.trim()

      const supplier = supplierName
        ? await prisma.sUP_Supplier.findFirst({ where: { name: supplierName }, select: { id: true } })
        : null

      if (!supplier) {
        r.errors.push(`PO ${rec.patiscoDocId}: 找不到供應商 "${supplierName}"`)
        continue
      }

      const existing = await prisma.pO_Order.findUnique({
        where: { poNo },
        select: { id: true },
      })
      if (existing) {
        // 暫時不做 source 判斷（PO_Order 無 source 欄位），直接 skip
        r.skipped++
        continue
      }

      // 嘗試連結 SLS_Order（同訂單號碼）
      const salesOrder = await prisma.sLS_Order.findFirst({
        where: { orderNo: poNo },
        select: { id: true },
      })

      const order = await prisma.pO_Order.create({
        data: {
          poNo,
          supplierId: supplier.id,
          salesOrderId: salesOrder?.id ?? null,
          sourceType: salesOrder ? 1 : 0,
          status: 1,
          currencyCode: resolvePatiscoCurrency(header.payment),
          exchangeRate: 1,
          totalAmount: toDecimal(raw.price?.amount),
          orderDate: parsePatiscoDate(header.createdDate) ?? new Date(),
          patiscoOrderId: rec.patiscoDocId,
          patiscoOrderNo: rec.patiscoDocNo,
          patiscoStatus: header.status ?? undefined,
          syncJobId: jobId,
          createdBy: SYS_USER_ID,
        },
      })

      for (const p of (raw.products ?? [])) {
        const sku = p.sku?.trim()
        if (!sku) continue
        const product = await prisma.pRD_Product.findUnique({ where: { sku }, select: { id: true } })
        if (!product) continue

        await prisma.pO_Item.create({
          data: {
            orderId: order.id,
            productId: product.id,
            unitPrice: toDecimal(p.price),
            quantity: toInt(p.quantity),
            unit: p.unit?.trim() ?? undefined,
            productNameSnapshot: p.specification?.trim() || p.modelNo?.trim() || undefined,
          },
        })
      }
      r.created++
    } catch (e) {
      r.errors.push(`PO ${rec.patiscoDocId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return r
}

// ─── Step 6：PO_SupplierPI ────────────────────────────────────────────────────

export async function step6_poSupplierPIs(prisma: PrismaClient, jobId: number): Promise<SyncStepResult> {
  const r: SyncStepResult = { created: 0, updated: 0, skipped: 0, errors: [] }
  const records = await getRawRecords(prisma, 'PI_COPY')

  for (const rec of records) {
    try {
      const raw = rec.result as { sellerName?: string | null; buyerName?: string | null }
      // PI_COPY = 供應商 PI 副本寄給我方（我方是 buyer），sellerName 是供應商名稱
      const sellerName = raw?.sellerName?.trim()
      if (!sellerName) { r.skipped++; continue }

      const piNo = rec.patiscoDocNo?.trim() || rec.patiscoDocId
      if (!piNo) { r.skipped++; continue }

      const existingPI = await prisma.pO_SupplierPI.findFirst({
        where: { piNo },
        select: { id: true },
      })
      if (existingPI) { r.skipped++; continue }

      // 找對應 PO_Order：用供應商名稱找最近的
      const supplier = sellerName
        ? await prisma.sUP_Supplier.findFirst({ where: { name: sellerName }, select: { id: true } })
        : null

      const poOrder = supplier
        ? await prisma.pO_Order.findFirst({
            where: { supplierId: supplier.id },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          })
        : null

      if (!poOrder) {
        r.errors.push(`PI_COPY ${rec.patiscoDocId}: 找不到對應的 PO_Order，供應商="${sellerName}"`)
        continue
      }

      await prisma.pO_SupplierPI.create({
        data: {
          orderId: poOrder.id,
          piNo,
          piDate: new Date(),
          source: 'PATISCO',
          patiscoDocId: rec.patiscoDocId,
          patiscoDocNo: rec.patiscoDocNo,
          syncJobId: jobId,
          performedBy: null,
        },
      })
      r.created++
    } catch (e) {
      r.errors.push(`PI_COPY ${rec.patiscoDocId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return r
}

// ─── Step 7：SLS_PI ───────────────────────────────────────────────────────────

export async function step7_slsPIs(prisma: PrismaClient, jobId: number): Promise<SyncStepResult> {
  const r: SyncStepResult = { created: 0, updated: 0, skipped: 0, errors: [], conflicts: [] }
  const records = await getRawRecords(prisma, 'PI')

  // 預載 lookup 表，避免迴圈內重複 DB 查詢
  const [allProducts, allCustomers, allOrders, allPIs] = await Promise.all([
    prisma.pRD_Product.findMany({ select: { id: true, sku: true } }),
    prisma.cUS_Customer.findMany({ select: { id: true, name: true } }),
    prisma.sLS_Order.findMany({ select: { id: true, orderNo: true } }),
    prisma.sLS_PI.findMany({ select: { id: true, piNo: true, source: true } }),
  ])
  const productMap = new Map(allProducts.map(p => [p.sku, p.id]))
  const customerMap = new Map(allCustomers.map(c => [c.name, c.id]))
  const orderMap = new Map(allOrders.map(o => [o.orderNo, o.id]))
  const piMap = new Map(allPIs.map(p => [p.piNo, p]))

  // 偵測重複：同一 piNo 出現在多筆 SYS_PatiscoSync → 收集衝突，跳過不自動建立
  const byPiNo = new Map<string, typeof records>()
  for (const rec of records) {
    const piNo = rec.patiscoDocNo?.trim()
    if (!piNo) continue  // 空號碼的草稿另行略過
    if (!byPiNo.has(piNo)) byPiNo.set(piNo, [])
    byPiNo.get(piNo)!.push(rec)
  }
  const conflictPiNos = new Set<string>()
  for (const [piNo, recs] of Array.from(byPiNo.entries())) {
    if (recs.length <= 1) continue
    // 若 DB 裡已有這筆 PI（上次用戶已解決衝突），不再重複提示
    if (piMap.has(piNo)) continue
    conflictPiNos.add(piNo)
    const conflictRecords: PIConflictRecord[] = recs.map(rec => {
      const raw = rec.result as { header?: Record<string, unknown>; products?: PatiscoOrderDetailItem[]; price?: { amount?: string } | null }
      const h = raw?.header as Record<string, unknown> | undefined
      const buyer = h?.buyer as { name?: string } | undefined
      return {
        docId: rec.patiscoDocId,
        buyerName: buyer?.name?.trim() ?? null,
        date: h?.createdDate as string | null ?? null,
        amount: (raw?.price as { amount?: string } | null)?.amount ?? null,
        products: (raw?.products ?? []).map((p: PatiscoOrderDetailItem) => ({
          sku: p.sku ?? '',
          modelNo: p.modelNo ?? null,
          specification: p.specification ?? null,
          quantity: p.quantity ?? null,
          price: p.price ?? null,
          unit: p.unit ?? null,
        })),
      }
    })
    r.conflicts!.push({ piNo, records: conflictRecords })
  }

  for (const rec of records) {
    try {
      const raw = rec.result as {
        header?: ReturnType<typeof extractOrderDetail>
        products?: PatiscoOrderDetailItem[]
        price?: { amount?: string } | null
      }
      const header = raw?.header
      if (!header) { r.skipped++; continue }

      if (!isSelf(header.seller?.name)) { r.skipped++; continue }

      const piNo = rec.patiscoDocNo.trim()
      if (!piNo) { r.skipped++; continue }

      // 有衝突的 piNo 等用戶手動解決，此次略過
      if (conflictPiNos.has(piNo)) { r.skipped++; continue }

      const existing = piMap.get(piNo)
      if (existing) {
        if (existing.source === 'PATISCO') {
          await prisma.sLS_PI.update({
            where: { piNo },
            data: { patiscoDocId: rec.patiscoDocId, patiscoStatus: header.status ?? undefined, archivedAt: null },
          })
          r.updated++
        } else {
          r.skipped++
        }
        continue
      }

      // PI 的幣別（header.currencyCode 是 Patisco 內部編號，header.payment 是交易條件）
      const buyerName = header.buyer?.name?.trim()
      const rawHeader = header as unknown as { currencyCode?: string; expiredDate?: string | null }
      const currencyCode = resolvePatiscoCurrency(rawHeader.currencyCode)
      const customerId = buyerName ? customerMap.get(buyerName) ?? undefined : undefined

      // 如果 PO_COPY 已在 step4 建立了 SLS_Order，則連結；否則 PI 獨立存在
      const orderId = orderMap.get(piNo) ?? undefined

      if (orderId) {
        // 補齊 step4 建立時缺少的幣別、客戶、日期
        await prisma.sLS_Order.update({
          where: { id: orderId },
          data: {
            currencyCode,
            customerId,
            orderDate: parsePatiscoDate(header.createdDate) ?? undefined,
            patiscoBuyerName: buyerName ?? undefined,
          },
        })
      }
      // 不建假的 SLS_Order：PI 自帶 customerId/currencyCode/totalAmount

      // 建立品項 lookup：有 orderId 時走 SLS_Item，否則只用 productId
      const skuToItemId = new Map<string, number>()
      const skuToProductId = new Map<string, number>()
      for (const p of (raw.products ?? [])) {
        const sku = p.sku?.trim()
        if (!sku) continue
        const productId = productMap.get(sku)
        if (!productId) continue
        skuToProductId.set(sku, productId)
        if (orderId) {
          const existingItem = await prisma.sLS_Item.findFirst({
            where: { orderId, productId },
            select: { id: true },
          })
          if (existingItem) {
            skuToItemId.set(sku, existingItem.id)
          } else {
            const newItem = await prisma.sLS_Item.create({
              data: {
                orderId,
                productId,
                unitPrice: toDecimal(p.price),
                quantity: toInt(p.quantity),
                unit: p.unit?.trim() ?? undefined,
                productNameSnapshot: p.specification?.trim() || p.modelNo?.trim() || undefined,
                customerSkuRef: sku,
              },
            })
            skuToItemId.set(sku, newItem.id)
          }
        }
      }

      const rawPrice = raw.price as { amount?: string } | null
      const totalAmount = rawPrice?.amount ? toDecimal(rawPrice.amount) : undefined

      const pi = await prisma.sLS_PI.create({
        data: {
          orderId: orderId ?? undefined,
          customerId: orderId ? undefined : customerId,
          currencyCode: orderId ? undefined : currencyCode,
          totalAmount: orderId ? undefined : totalAmount,
          piNo,
          piDate: parsePatiscoDate(header.createdDate) ?? new Date(),
          estimatedShipDate: parsePatiscoDate(rawHeader.expiredDate) ?? undefined,
          status: 0,
          source: 'PATISCO',
          patiscoDocId: rec.patiscoDocId,
          patiscoDocNo: rec.patiscoDocNo,
          patiscoCreatedAt: parsePatiscoDate(header.createdDate) ?? undefined,
          patiscoStatus: header.status ?? undefined,
          syncJobId: jobId,
          performedBy: null,
        },
      })
      piMap.set(piNo, { id: pi.id, piNo, source: 'PATISCO' })

      // 建立 SLS_PIItem
      for (const p of (raw.products ?? [])) {
        const sku = p.sku?.trim()
        if (!sku) continue
        const slsItemId = skuToItemId.get(sku)
        const productId = skuToProductId.get(sku)
        if (!slsItemId && !productId) continue
        await prisma.sLS_PIItem.create({
          data: {
            piId: pi.id,
            slsItemId: slsItemId ?? undefined,
            productId: slsItemId ? undefined : productId,
            quantity: toInt(p.quantity),
            unitPrice: toDecimal(p.price),
            unit: p.unit?.trim() ?? undefined,
          },
        })
      }
      r.created++
    } catch (e) {
      r.errors.push(`PI ${rec.patiscoDocId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return r
}

// ─── 衝突解決：從指定 SYS_PatiscoSync docId 建立單筆 SLS_PI ─────────────────

export async function step7_buildOnePIFromDocId(
  prisma: PrismaClient,
  docId: string,
  jobId: number,
): Promise<void> {
  const rec = await prisma.sYS_PatiscoSync.findFirst({ where: { patiscoDocId: docId, docType: 'PI' } })
  if (!rec) throw new Error(`找不到 docId=${docId} 的 PI 記錄`)

  const raw = rec.result as {
    header?: ReturnType<typeof extractOrderDetail>
    products?: PatiscoOrderDetailItem[]
    price?: { amount?: string } | null
  }
  const header = raw?.header
  if (!header) throw new Error('此記錄缺少 header 資料')

  const piNo = rec.patiscoDocNo?.trim()
  if (!piNo) throw new Error('此記錄沒有 PI 號碼')

  // 若 SLS_PI 已存在，刪除後重建（用戶選擇覆蓋）
  const existingPI = await prisma.sLS_PI.findUnique({ where: { piNo } })
  if (existingPI) {
    await prisma.sLS_PIItem.deleteMany({ where: { piId: existingPI.id } })
    await prisma.sLS_PI.delete({ where: { piNo } })
  }

  await initSelfKeywords(prisma)
  if (!isSelf(header.seller?.name)) throw new Error('此記錄的 seller 不是我方')

  const buyerName = header.buyer?.name?.trim()
  const rawHeader = header as unknown as { currencyCode?: string; expiredDate?: string | null }
  const currencyCode = resolvePatiscoCurrency(rawHeader.currencyCode)

  const customer = buyerName
    ? await prisma.cUS_Customer.findFirst({ where: { name: buyerName }, select: { id: true } })
    : null

  let salesOrder = await prisma.sLS_Order.findUnique({ where: { orderNo: piNo }, select: { id: true } })
  if (salesOrder) {
    await prisma.sLS_Order.update({
      where: { id: salesOrder.id },
      data: { currencyCode, customerId: customer?.id ?? undefined, orderDate: parsePatiscoDate(header.createdDate) ?? undefined, patiscoBuyerName: buyerName ?? undefined },
    })
  } else {
    salesOrder = await prisma.sLS_Order.create({
      data: {
        orderNo: piNo, customerId: customer?.id ?? undefined, status: 1,
        currencyCode, exchangeRate: 1,
        orderDate: parsePatiscoDate(header.createdDate) ?? new Date(),
        source: 'PATISCO', patiscoBuyerName: buyerName ?? undefined,
        patiscoDocId: rec.patiscoDocId, patiscoDocNo: rec.patiscoDocNo,
        syncJobId: jobId || undefined, createdBy: SYS_USER_ID, performedBy: null,
      },
    })
  }

  const skuToItemId = new Map<string, number>()
  for (const p of (raw.products ?? [])) {
    const sku = p.sku?.trim()
    if (!sku) continue
    const product = await prisma.pRD_Product.findUnique({ where: { sku }, select: { id: true } })
    if (!product) continue
    const existingItem = await prisma.sLS_Item.findFirst({ where: { orderId: salesOrder.id, productId: product.id }, select: { id: true } })
    if (existingItem) {
      skuToItemId.set(sku, existingItem.id)
    } else {
      const newItem = await prisma.sLS_Item.create({
        data: {
          orderId: salesOrder.id, productId: product.id,
          unitPrice: toDecimal(p.price), quantity: toInt(p.quantity),
          unit: p.unit?.trim() ?? undefined,
          productNameSnapshot: p.specification?.trim() || p.modelNo?.trim() || undefined,
          customerSkuRef: sku,
        },
      })
      skuToItemId.set(sku, newItem.id)
    }
  }

  const pi = await prisma.sLS_PI.create({
    data: {
      orderId: salesOrder.id, piNo,
      piDate: parsePatiscoDate(header.createdDate) ?? new Date(),
      estimatedShipDate: parsePatiscoDate(rawHeader.expiredDate) ?? undefined,
      status: 0, source: 'PATISCO',
      patiscoDocId: rec.patiscoDocId, patiscoDocNo: rec.patiscoDocNo,
      patiscoCreatedAt: parsePatiscoDate(header.createdDate) ?? undefined,
      patiscoStatus: header.status ?? undefined,
      syncJobId: jobId || undefined, performedBy: null,
    },
  })

  for (const p of (raw.products ?? [])) {
    const sku = p.sku?.trim()
    if (!sku) continue
    const slsItemId = skuToItemId.get(sku)
    if (!slsItemId) continue
    await prisma.sLS_PIItem.create({
      data: { piId: pi.id, slsItemId, quantity: toInt(p.quantity), unitPrice: toDecimal(p.price), unit: p.unit?.trim() ?? undefined },
    })
  }
}

// ─── Step 8：SLS_Shipment ─────────────────────────────────────────────────────

export async function step8_slsShipments(prisma: PrismaClient, jobId: number): Promise<SyncStepResult> {
  const r: SyncStepResult = { created: 0, updated: 0, skipped: 0, errors: [] }
  const records = await getRawRecords(prisma, 'DO')

  for (const rec of records) {
    try {
      const raw = rec.result as { packingList?: PatiscoShipmentDetail; commercialInvoice?: PatiscoShipmentDetail }
      const pl = raw?.packingList
      const ci = raw?.commercialInvoice
      const detail = pl ?? ci
      if (!detail) { r.skipped++; continue }

      const shipmentNo = (detail.no ?? rec.patiscoDocNo ?? '').trim()
      if (!shipmentNo) { r.skipped++; continue }

      const existing = await prisma.sLS_Shipment.findUnique({
        where: { shipmentNo },
        select: { id: true, source: true, archivedAt: true },
      })
      if (existing) {
        if (existing.source === 'PATISCO' && existing.archivedAt) {
          await prisma.sLS_Shipment.update({ where: { shipmentNo }, data: { archivedAt: null } })
          r.updated++
        } else {
          r.skipped++
        }
        continue
      }

      const buyerName = detail.buyer?.name?.trim()
      const customer = buyerName
        ? await prisma.cUS_Customer.findFirst({ where: { name: buyerName }, select: { id: true } })
        : null

      // 出貨單連 PI：DO 裡的 orders[].no 可能含額外說明（如 "E2520244 KY"）
      // 嘗試完整號碼，找不到再取第一段（空格前）
      const rawOrderNos = (detail.orders ?? [])
        .map((o: { no?: string }) => o.no?.trim())
        .filter(Boolean) as string[]
      const piNos = rawOrderNos.map(no => {
        const base = no.split(' ')[0]
        return base
      }).filter(Boolean)

      const linkedPIs = piNos.length > 0
        ? await prisma.sLS_PI.findMany({
            where: { piNo: { in: piNos } },
            select: { id: true, piNo: true },
          })
        : []

      const shipDate = parsePatiscoDate(detail.shipDate ?? detail.createdDate) ?? new Date()

      const shipment = await prisma.sLS_Shipment.create({
        data: {
          shipmentNo,
          customerId: customer?.id ?? undefined,
          actualShipDate: shipDate,
          source: 'PATISCO',
          patiscoDocId: rec.patiscoDocId,
          patiscoDocNo: rec.patiscoDocNo,
          packingListNo: pl?.no ?? undefined,
          commercialInvNo: ci?.no ?? undefined,
          syncJobId: jobId,
          performedBy: null,
        },
      })

      // 建立 SLS_ShipmentPI（出貨單 ↔ PI 關聯）
      for (const pi of linkedPIs) {
        await prisma.sLS_ShipmentPI.create({
          data: { shipmentId: shipment.id, piId: pi.id },
        })
      }

      // 預載 piId → (sku → slsItemId) Map，用於建立 SLS_ShipmentItem
      const piSkuToSlsItemId = new Map<string, number>()
      if (linkedPIs.length > 0) {
        const piItems = await prisma.sLS_PIItem.findMany({
          where: { piId: { in: linkedPIs.map(p => p.id) } },
          select: {
            piId: true,
            slsItemId: true,
            slsItem: { select: { product: { select: { sku: true } } } },
          },
        })
        for (const item of piItems) {
          const sku = item.slsItem?.product?.sku
          if (sku && item.slsItemId != null) piSkuToSlsItemId.set(`${item.piId}:${sku}`, item.slsItemId)
        }
      }

      // 建立 SLS_ShipmentItem
      const packings = (pl?.packings ?? ci?.packings ?? []) as Array<{
        sku?: string
        quantity?: string
        grossWeight?: string
        netWeight?: string
        imperialTotalDimension?: string
        sourceOrderNo?: string
        quantityOfCartons?: string
      }>

      for (const packing of packings) {
        const sku = packing.sku?.trim()
        const sourceOrderNo = packing.sourceOrderNo?.trim()
        const matchedPI = sourceOrderNo
          ? linkedPIs.find(p => p.piNo === sourceOrderNo)
          : linkedPIs[0]

        const piId = matchedPI?.id ?? linkedPIs[0]?.id ?? null
        const slsItemId = (piId && sku) ? (piSkuToSlsItemId.get(`${piId}:${sku}`) ?? null) : null

        await prisma.sLS_ShipmentItem.create({
          data: {
            shipmentId: shipment.id,
            piId,
            slsItemId,
            rawSku: sku ?? undefined,
            quantity: toInt(packing.quantity),
            grossWeightKg: packing.grossWeight ? parseFloat(packing.grossWeight) : undefined,
            cubicFt: packing.imperialTotalDimension
              ? parseFloat(packing.imperialTotalDimension)
              : undefined,
          },
        })
      }
      r.created++
    } catch (e) {
      r.errors.push(`DO ${rec.patiscoDocId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 修復舊資料：補查所有 slsItemId = null 但 rawSku 有值的 SLS_ShipmentItem
  const broken = await prisma.sLS_ShipmentItem.findMany({
    where: { slsItemId: null, rawSku: { not: null } },
    select: { id: true, piId: true, rawSku: true },
  })
  for (const item of broken) {
    if (!item.piId || !item.rawSku) continue
    const piItem = await prisma.sLS_PIItem.findFirst({
      where: {
        piId: item.piId,
        slsItem: { product: { sku: item.rawSku } },
      },
      select: { slsItemId: true },
    })
    if (piItem) {
      await prisma.sLS_ShipmentItem.update({
        where: { id: item.id },
        data: { slsItemId: piItem.slsItemId },
      })
      r.updated++
    }
  }

  return r
}

// ─── Step 9：資料品質告警 ──────────────────────────────────────────────────────

async function step9_dataAlerts(prisma: PrismaClient, jobId: number): Promise<SyncStepResult> {
  const r: SyncStepResult = { created: 0, updated: 0, skipped: 0, errors: [] }

  // 清掉本次 job 產生的舊 alert，重新偵測
  await prisma.sYS_DataAlert.deleteMany({ where: { syncJobId: jobId, resolvedAt: null } })

  // ① 出貨單引用了不存在的 PI（MISSING_PI）
  const shipmentItems = await prisma.sLS_ShipmentItem.findMany({
    where: { slsItemId: null, rawSku: { not: null } },
    select: {
      id: true, rawSku: true, piId: true,
      shipment: { select: { id: true, shipmentNo: true } },
    },
  })
  // 按出貨單分組，只出一條 alert
  const missingByShipment = new Map<number, { shipmentNo: string; skus: string[] }>()
  for (const item of shipmentItems) {
    if (!item.shipment) continue
    const entry = missingByShipment.get(item.shipment.id) ?? { shipmentNo: item.shipment.shipmentNo ?? '', skus: [] }
    if (item.rawSku && !entry.skus.includes(item.rawSku)) entry.skus.push(item.rawSku)
    missingByShipment.set(item.shipment.id, entry)
  }
  for (const [shipmentId, { shipmentNo, skus }] of Array.from(missingByShipment)) {
    await prisma.sYS_DataAlert.create({
      data: {
        type: 'MISSING_PI',
        refType: 'SLS_Shipment',
        refId: shipmentId,
        refNo: shipmentNo,
        message: `出貨單 ${shipmentNo} 有 ${skus.length} 個品項找不到對應的 PI 品項`,
        detail: { skus, hint: '可能是對應的 PI 尚未建立，或 PI 衝突未解決。下次同步後若 PI 已建立，此告警會自動消失。' },
        syncJobId: jobId,
      },
    })
    r.created++
  }

  // ② 出貨單引用了 Patisco 有但 PAXIS 沒有建立的 PI（shipmentPI 有 piNo 但查無 SLS_PI）
  // 已由 ① 涵蓋（slsItemId=null 代表 PI 缺失），不重複 alert

  // ③ 流程缺口：SLS_PI 存在但對應的 SLS_Order 沒有任何 PO_Order
  const pisWithoutPO = await prisma.sLS_PI.findMany({
    where: {
      order: {
        purchaseOrders: { none: {} },
      },
    },
    select: { id: true, piNo: true, orderId: true },
    take: 50,
  })
  for (const pi of pisWithoutPO) {
    await prisma.sYS_DataAlert.create({
      data: {
        type: 'WORKFLOW_GAP',
        refType: 'SLS_PI',
        refId: pi.id,
        refNo: pi.piNo,
        message: `PI ${pi.piNo} 找不到對應的採購訂單（PO）`,
        detail: { hint: '若此 PI 已有對應供應商，請在採購頁面補建 PO，下次同步後此告警會自動消失。' },
        syncJobId: jobId,
      },
    })
    r.created++
  }

  return r
}

// ─── Phase 2 主控 ─────────────────────────────────────────────────────────────

const PHASE2_STEPS: Array<{ name: string; fn: (p: PrismaClient, j: number) => Promise<SyncStepResult> }> = [
  { name: 'customers',       fn: step1_customers },
  { name: 'suppliers',       fn: step2_suppliers },
  { name: 'products',        fn: step3_products },
  { name: 'sls_orders',      fn: step4_slsOrders },
  { name: 'po_orders',       fn: step5_poOrders },
  { name: 'po_supplier_pis', fn: step6_poSupplierPIs },
  { name: 'sls_pis',         fn: step7_slsPIs },
  { name: 'sls_shipments',   fn: step8_slsShipments },
  { name: 'data_alerts',     fn: step9_dataAlerts },
]

async function initSelfKeywords(prisma: PrismaClient) {
  const company = await prisma.sYS_Company.findFirst()
  SELF_COMPANY_KEYWORDS = [
    company?.nameEn,
    company?.nameZh,
    company?.shortName,
  ].filter((n): n is string => !!n).map(n => n.toLowerCase())
  console.log('[phase2] 自方公司關鍵字:', SELF_COMPANY_KEYWORDS)
}

/** 執行下一個未完成的 phase2 step，回傳 { stepName, result, nextStep, done } */
export async function phase2RunNextStep(
  prisma: PrismaClient,
  jobId: number,
): Promise<{ stepName: string; result: SyncStepResult; nextStep: string | null; done: boolean }> {
  await initSelfKeywords(prisma)

  const job = await prisma.sYS_SyncJob.findUnique({ where: { id: jobId }, select: { phase2Step: true, result: true } })
  const currentStep = job?.phase2Step ?? null

  // 找出下一個要跑的 step
  let nextIdx = 0
  if (currentStep && currentStep !== 'done') {
    const doneIdx = PHASE2_STEPS.findIndex(s => s.name === currentStep)
    nextIdx = doneIdx + 1
  }

  if (nextIdx >= PHASE2_STEPS.length) {
    await setPhase2Step(prisma, jobId, 'done')
    return { stepName: 'done', result: { created: 0, updated: 0, skipped: 0, errors: [] }, nextStep: null, done: true }
  }

  const step = PHASE2_STEPS[nextIdx]
  await setPhase2Step(prisma, jobId, step.name)
  const result = await step.fn(prisma, jobId)
  console.log(`[phase2] ${step.name}:`, result)

  // 把這次結果 merge 進 SYS_SyncJob.result
  const prevResult = (job?.result as Record<string, SyncStepResult> | null) ?? {}
  await prisma.sYS_SyncJob.update({
    where: { id: jobId },
    data: { result: { ...prevResult, [step.name]: result } as object },
  })

  const isLast = nextIdx === PHASE2_STEPS.length - 1
  if (isLast) await setPhase2Step(prisma, jobId, 'done')

  const afterIdx = nextIdx + 1
  const nextStep = afterIdx < PHASE2_STEPS.length ? PHASE2_STEPS[afterIdx].name : null

  return { stepName: step.name, result, nextStep, done: isLast }
}

export async function phase2ParseAll(
  prisma: PrismaClient,
  jobId: number,
): Promise<Record<string, SyncStepResult>> {
  await initSelfKeywords(prisma)

  const results: Record<string, SyncStepResult> = {}

  for (const step of PHASE2_STEPS) {
    await setPhase2Step(prisma, jobId, step.name)
    results[step.name] = await step.fn(prisma, jobId)
    console.log(`[phase2] ${step.name}:`, results[step.name])
  }

  await setPhase2Step(prisma, jobId, 'done')
  return results
}

// ─── 主入口 ───────────────────────────────────────────────────────────────────

export async function runPatiscoSync(
  trigger: string,
  prisma: PrismaClient,
  creds?: PatiscoCredentials,
): Promise<SyncResult> {
  const job = await prisma.sYS_SyncJob.create({
    data: { status: 'running', trigger, performedBy: SYS_USER_ID },
  })
  const jobId = job.id

  try {
    const resolvedCreds = creds ?? await patiscoLogin(prisma)
    if (!resolvedCreds) {
      await prisma.sYS_SyncJob.update({
        where: { id: jobId },
        data: { status: 'error', errorAt: new Date(), errorMsg: 'Patisco 登入失敗' },
      })
      return { jobId, status: 'error', phase1: { total: 0, done: 0, errors: [] }, phase2: {}, errorMsg: 'Patisco 登入失敗' }
    }

    await prisma.sYS_SyncJob.update({ where: { id: jobId }, data: { status: 'phase1' } })
    const phase1 = await phase1FetchAll(prisma, resolvedCreds, jobId)

    await prisma.sYS_SyncJob.update({ where: { id: jobId }, data: { status: 'phase2' } })
    const phase2 = await phase2ParseAll(prisma, jobId)

    await prisma.sYS_SyncJob.update({
      where: { id: jobId },
      data: { status: 'completed', completedAt: new Date(), result: { phase1, phase2 } as object },
    })

    return { jobId, status: 'completed', phase1, phase2 }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await prisma.sYS_SyncJob.update({
      where: { id: jobId },
      data: { status: 'error', errorAt: new Date(), errorMsg: msg },
    })
    return { jobId, status: 'error', phase1: { total: 0, done: 0, errors: [] }, phase2: {}, errorMsg: msg }
  }
}

// ─── 回滾（取消 sync job）────────────────────────────────────────────────────

export async function rollbackSyncJob(prisma: PrismaClient, jobId: number): Promise<void> {
  await prisma.sLS_ShipmentPI.deleteMany({ where: { shipment: { syncJobId: jobId } } })
  await prisma.sLS_ShipmentItem.deleteMany({ where: { shipment: { syncJobId: jobId } } })
  await prisma.sLS_Shipment.deleteMany({ where: { syncJobId: jobId } })

  await prisma.sLS_PIItem.deleteMany({ where: { pi: { syncJobId: jobId } } })
  await prisma.sLS_PI.deleteMany({ where: { syncJobId: jobId } })

  await prisma.pO_SupplierPIItem.deleteMany({ where: { supplierPI: { syncJobId: jobId } } })
  await prisma.pO_SupplierPI.deleteMany({ where: { syncJobId: jobId } })

  await prisma.pO_Item.deleteMany({ where: { order: { syncJobId: jobId } } })
  await prisma.pO_Order.deleteMany({ where: { syncJobId: jobId } })

  await prisma.sLS_Item.deleteMany({ where: { order: { syncJobId: jobId } } })
  await prisma.sLS_Order.deleteMany({ where: { syncJobId: jobId } })

  await prisma.pRD_Product.deleteMany({ where: { syncJobId: jobId } })
  await prisma.sUP_Supplier.deleteMany({ where: { syncJobId: jobId } })
  await prisma.cUS_Customer.deleteMany({ where: { syncJobId: jobId } })

  await prisma.sYS_SyncJob.update({
    where: { id: jobId },
    data: { status: 'cancelled', cancelledAt: new Date() },
  })
}

// ─── 向後相容 export（route.ts 仍引用）────────────────────────────────────────

/** @deprecated 改用 runPatiscoSync */
export async function syncPatiscoPIs(
  _trigger: string,
  prisma: PrismaClient,
  _sessionId?: string,
  creds?: PatiscoCredentials,
) {
  return runPatiscoSync('manual', prisma, creds ?? undefined)
}

/** @deprecated */
export async function syncPatiscoBuyers(_t: string, _p: PrismaClient, _c?: PatiscoCredentials) {
  return { skipped: true }
}

/** @deprecated */
export async function syncPatiscoSupplierPOs(
  _t: string, _p: PrismaClient, _s?: string, _c?: PatiscoCredentials,
) {
  return { skipped: true }
}

/** @deprecated */
export async function syncPatiscoDeliveryOrders(_t: string, _p: PrismaClient, _c?: PatiscoCredentials) {
  return { skipped: true }
}

/** @deprecated */
export async function backfillShipmentPILinks(_t: string, _p: PrismaClient) {
  return { skipped: true }
}

/** @deprecated */
export async function seedDOQueue(_p: PrismaClient, _c?: PatiscoCredentials) {
  return { skipped: true }
}

/** @deprecated */
export async function processNextPendingDO(
  _t: string, _p: PrismaClient, _s?: string, _c?: PatiscoCredentials,
) {
  return { skipped: true }
}
