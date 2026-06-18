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

// Point Asia 公司名稱關鍵字（用於主從判定）
const SELF_COMPANY_KEYWORDS = ['point asia', 'pointasia', 'xinosys', '錫諾']

// ─── 型別 ────────────────────────────────────────────────────────────────────

export type SyncStepResult = {
  created: number
  updated: number
  skipped: number
  errors: string[]
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
  const id = String(item.ID ?? item.id ?? '')
  const [headerR, products] = await Promise.all([
    getOrderCopyDetail(creds, id),
    fetchAllCopyProducts(creds, id),
  ])
  const header = headerR.ok ? (headerR.data?.data ?? headerR.data?.item ?? null) : null
  return { header, products }
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

  for (const cfg of DOC_CONFIGS) {
    const items = await fetchAllPages<Record<string, unknown>>(
      (page) => cfg.listFn(creds, page),
    )
    total += items.length
    console.log(`[phase1] ${cfg.docType}: ${items.length} items`)

    for (const item of items) {
      const { id, no } = cfg.getIdNo(item)
      if (!id) continue

      // 增量判斷：若 Patisco lastModifiedDate 沒有變，跳過
      const existing = await prisma.sYS_PatiscoSync.findUnique({
        where: { docType_patiscoDocId: { docType: cfg.docType, patiscoDocId: id } },
        select: { patiscoModifiedAt: true },
      })

      const patiscoModifiedAt = parsePatiscoDate(
        String(item.LastModifiedDate ?? item.lastModifiedDate ?? item.CreatedDate ?? item.createdDate ?? ''),
      )

      if (existing?.patiscoModifiedAt && patiscoModifiedAt) {
        if (patiscoModifiedAt <= existing.patiscoModifiedAt) {
          done++
          continue
        }
      }

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
  const records = await getRawRecords(prisma, 'PO_COPY')

  for (const rec of records) {
    try {
      const raw = rec.result as { header?: PatiscoOrderCopyDetail }
      const header = raw?.header
      if (!header) { r.skipped++; continue }

      if (!isSelf(header.seller?.name)) {
        console.warn(`[step1] PO_COPY ${rec.patiscoDocId} seller 不是我方: ${header.seller?.name}`)
        r.skipped++; continue
      }

      const buyerName = header.buyer?.name?.trim()
      if (!buyerName) { r.skipped++; continue }

      const existing = await prisma.cUS_Customer.findFirst({
        where: { name: buyerName },
        select: { id: true },
      })
      if (existing) { r.skipped++; continue }

      await prisma.cUS_Customer.create({
        data: {
          name: buyerName,
          address: header.buyer?.address ?? undefined,
          syncJobId: jobId,
          currencyCode: 'USD',
          exchangeRate: 1,
          createdBy: SYS_USER_ID,
        } as Parameters<typeof prisma.cUS_Customer.create>[0]['data'],
      })
      r.created++
    } catch (e) {
      r.errors.push(`PO_COPY ${rec.patiscoDocId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return r
}

// ─── Step 2：供應商主檔 ────────────────────────────────────────────────────────

export async function step2_suppliers(prisma: PrismaClient, jobId: number): Promise<SyncStepResult> {
  const r: SyncStepResult = { created: 0, updated: 0, skipped: 0, errors: [] }
  const records = await getRawRecords(prisma, 'PI_COPY')

  for (const rec of records) {
    try {
      const raw = rec.result as { header?: PatiscoOrderCopyDetail }
      const header = raw?.header
      if (!header) { r.skipped++; continue }

      if (!isSelf(header.buyer?.name)) {
        console.warn(`[step2] PI_COPY ${rec.patiscoDocId} buyer 不是我方: ${header.buyer?.name}`)
        r.skipped++; continue
      }

      const sellerName = header.seller?.name?.trim()
      if (!sellerName) { r.skipped++; continue }

      const existing = await prisma.sUP_Supplier.findFirst({
        where: { name: sellerName },
        select: { id: true },
      })
      if (existing) { r.skipped++; continue }

      await prisma.sUP_Supplier.create({
        data: {
          name: sellerName,
          address: header.seller?.address ?? undefined,
          city: header.seller?.city ?? undefined,
          countryCode: header.seller?.countryCode ?? undefined,
          phoneNo: header.seller?.phoneNo ?? undefined,
          email: header.seller?.email ?? undefined,
          taxId: header.seller?.taxId ?? undefined,
          syncJobId: jobId,
          currencyCode: 'USD',
        },
      })
      r.created++
    } catch (e) {
      r.errors.push(`PI_COPY ${rec.patiscoDocId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return r
}

// ─── Step 3：產品主檔 ─────────────────────────────────────────────────────────

export async function step3_products(prisma: PrismaClient, jobId: number): Promise<SyncStepResult> {
  const r: SyncStepResult = { created: 0, updated: 0, skipped: 0, errors: [] }

  // 從所有文件收集 SKU（只存基本資料，不存價格）
  const skuMap = new Map<string, { name: string; modelNo?: string; spec?: string; unit?: string }>()

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
          name: item.specification?.trim() || item.modelNo?.trim() || sku,
          modelNo: item.modelNo?.trim(),
          spec: item.specification?.trim(),
          unit: item.unit?.trim(),
        })
      }
    }
  }

  for (const [sku, info] of Array.from(skuMap)) {
    try {
      const existing = await prisma.pRD_Product.findUnique({ where: { sku }, select: { id: true } })
      if (existing) { r.skipped++; continue }

      await prisma.pRD_Product.create({
        data: {
          sku,
          name: info.name,
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
      const raw = rec.result as { header?: PatiscoOrderCopyDetail; products?: PatiscoOrderCopyProduct[] }
      const header = raw?.header
      if (!header) { r.skipped++; continue }

      if (!isSelf(header.seller?.name)) { r.skipped++; continue }

      const orderNo = (header.no ?? rec.patiscoDocNo ?? '').trim()
      if (!orderNo) { r.skipped++; continue }

      const existing = await prisma.sLS_Order.findUnique({
        where: { orderNo },
        select: { id: true, source: true },
      })
      if (existing) {
        if (existing.source === 'PATISCO') {
          await prisma.sLS_Order.update({
            where: { orderNo },
            data: { patiscoDocId: rec.patiscoDocId, patiscoStatus: header.status ?? undefined },
          })
          r.updated++
        } else {
          r.skipped++  // 人工建立，不動
        }
        continue
      }

      const buyerName = header.buyer?.name?.trim()
      const customer = buyerName
        ? await prisma.cUS_Customer.findFirst({ where: { name: buyerName }, select: { id: true } })
        : null

      const order = await prisma.sLS_Order.create({
        data: {
          orderNo,
          customerId: customer?.id ?? undefined,
          status: 1,
          currencyCode: resolvePatiscoCurrency(header.payment),
          exchangeRate: 1,
          totalAmount: toDecimal(header.total?.amount),
          orderDate: parsePatiscoDate(header.createdDate) ?? new Date(),
          source: 'PATISCO',
          patiscoBuyerName: buyerName ?? undefined,
          patiscoDocId: rec.patiscoDocId,
          patiscoDocNo: rec.patiscoDocNo,
          patiscoCreatedAt: parsePatiscoDate(header.createdDate) ?? undefined,
          patiscoStatus: header.status ?? undefined,
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

      // 我方 PO：seller = 我方，buyer = 供應商
      if (!isSelf(header.seller?.name)) {
        console.warn(`[step5] PO ${rec.patiscoDocId} seller 不是我方: ${header.seller?.name}`)
        r.skipped++; continue
      }

      const poNo = rec.patiscoDocNo.trim() || rec.patiscoDocId
      const supplierName = header.buyer?.name?.trim()

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
          source: 'PATISCO',
          patiscoOrderId: rec.patiscoDocId,
          patiscoOrderNo: rec.patiscoDocNo,
          patiscoStatus: header.status ?? undefined,
          syncJobId: jobId,
          createdBy: SYS_USER_ID,
        } as Parameters<typeof prisma.pO_Order.create>[0]['data'],
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
      const raw = rec.result as { header?: PatiscoOrderCopyDetail }
      const header = raw?.header
      if (!header) { r.skipped++; continue }

      if (!isSelf(header.buyer?.name)) { r.skipped++; continue }

      const piNo = (header.no ?? rec.patiscoDocNo ?? '').trim()
      if (!piNo) { r.skipped++; continue }

      const existingPI = await prisma.pO_SupplierPI.findFirst({
        where: { piNo },
        select: { id: true },
      })
      if (existingPI) { r.skipped++; continue }

      // 找對應 PO_Order：用供應商名稱找最近的
      const sellerName = header.seller?.name?.trim()
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
          piDate: parsePatiscoDate(header.createdDate) ?? new Date(),
          source: 'PATISCO',
          patiscoDocId: rec.patiscoDocId,
          patiscoDocNo: rec.patiscoDocNo,
          patiscoCreatedAt: parsePatiscoDate(header.createdDate) ?? undefined,
          patiscoStatus: header.status ?? undefined,
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
  const r: SyncStepResult = { created: 0, updated: 0, skipped: 0, errors: [] }
  const records = await getRawRecords(prisma, 'PI')

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

      const existing = await prisma.sLS_PI.findUnique({
        where: { piNo },
        select: { id: true, source: true },
      })
      if (existing) {
        if (existing.source === 'PATISCO') {
          await prisma.sLS_PI.update({
            where: { piNo },
            data: { patiscoDocId: rec.patiscoDocId, patiscoStatus: header.status ?? undefined },
          })
          r.updated++
        } else {
          r.skipped++
        }
        continue
      }

      // 找 SLS_Order：用客戶名稱找最近的
      const buyerName = header.buyer?.name?.trim()
      const customer = buyerName
        ? await prisma.cUS_Customer.findFirst({ where: { name: buyerName }, select: { id: true } })
        : null

      const salesOrder = customer
        ? await prisma.sLS_Order.findFirst({
            where: { customerId: customer.id, archivedAt: null },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          })
        : null

      if (!salesOrder) {
        r.errors.push(`PI ${rec.patiscoDocId}: 找不到對應的 SLS_Order，客戶="${buyerName}"`)
        continue
      }

      const pi = await prisma.sLS_PI.create({
        data: {
          orderId: salesOrder.id,
          piNo,
          piDate: parsePatiscoDate(header.createdDate) ?? new Date(),
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

      for (const p of (raw.products ?? [])) {
        const sku = p.sku?.trim()
        if (!sku) continue
        const product = await prisma.pRD_Product.findUnique({ where: { sku }, select: { id: true } })
        if (!product) continue

        const slsItem = await prisma.sLS_Item.findFirst({
          where: { orderId: salesOrder.id, productId: product.id },
          select: { id: true },
        })
        if (!slsItem) continue

        await prisma.sLS_PIItem.create({
          data: {
            piId: pi.id,
            slsItemId: slsItem.id,
            quantity: toInt(p.quantity),
            unitPrice: toDecimal(p.price),  // 客戶賣價（≠ 供應商買價）
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
        select: { id: true, source: true },
      })
      if (existing) { r.skipped++; continue }

      const buyerName = detail.buyer?.name?.trim()
      const customer = buyerName
        ? await prisma.cUS_Customer.findFirst({ where: { name: buyerName }, select: { id: true } })
        : null

      // 出貨單只連 PI，不連 PO
      const piNos = (detail.orders ?? [])
        .map((o: { no?: string }) => o.no?.trim())
        .filter(Boolean) as string[]

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

        await prisma.sLS_ShipmentItem.create({
          data: {
            shipmentId: shipment.id,
            piId: matchedPI?.id ?? linkedPIs[0]?.id ?? null,
            slsItemId: null,
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
  return r
}

// ─── Phase 2 主控 ─────────────────────────────────────────────────────────────

export async function phase2ParseAll(
  prisma: PrismaClient,
  jobId: number,
): Promise<Record<string, SyncStepResult>> {
  const results: Record<string, SyncStepResult> = {}

  const steps: Array<{ name: string; fn: (p: PrismaClient, j: number) => Promise<SyncStepResult> }> = [
    { name: 'customers',      fn: step1_customers },
    { name: 'suppliers',      fn: step2_suppliers },
    { name: 'products',       fn: step3_products },
    { name: 'sls_orders',     fn: step4_slsOrders },
    { name: 'po_orders',      fn: step5_poOrders },
    { name: 'po_supplier_pis', fn: step6_poSupplierPIs },
    { name: 'sls_pis',        fn: step7_slsPIs },
    { name: 'sls_shipments',  fn: step8_slsShipments },
  ]

  for (const step of steps) {
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
