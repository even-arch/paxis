/**
 * GET /api/patisco/debug?tool=raw&name=getPIs&status=3&type=2   ← 原始 MCP 回傳（不解析）
 * GET /api/patisco/debug?tool=raw&name=getOrderCopyDetail&copyId=XXX  ← 測試 copyId 參數
 * GET /api/patisco/debug?tool=raw&name=getOrderCopyDetail&id=XXX      ← 測試 id 參數
 * GET /api/patisco/debug?tool=raw&name=getOrderCopyDetail&orderId=XXX ← 測試 orderId 參數
 * GET /api/patisco/debug?tool=listTools                               ← 查 MCP 工具清單+schema
 * GET /api/patisco/debug?tool=getPIs&status=3&type=2
 * GET /api/patisco/debug?tool=getBuyers&first=5
 * GET /api/patisco/debug?tool=getBuyerProductDetail&buyerId=X&productId=Y
 * GET /api/patisco/debug?tool=getBuyerCatalogs&buyerId=X
 * GET /api/patisco/debug?tool=getBuyerCategories&buyerId=X
 * GET /api/patisco/debug?tool=searchBuyers&query=X
 * 臨時工具，用於確認 MCP 回傳欄位結構（僅限 admin 使用）
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import {
  patiscoLogin,
  getPIs,
  getBuyerProductDetail,
  getBuyerCatalogs,
  getBuyerCategoryProducts,
  getBuyerCategories,
  searchBuyers,
  getBuyers,
  listOrderCopies,
  listTools,
  getOrderDetail,
  getOrderProducts,
  listProformaInvoices,
  listProformaInvoiceCopies,
} from '@/api/patisco/client'

const DEFAULT_MCP_URL = process.env.PATISCO_MCP_URL ?? 'https://mcp.patisco.com'

/** 直接打 MCP，跳過解析邏輯，回傳原始 JSON — 用來確認 Patisco 實際回傳格式 */
async function rawMcpCall(creds: { jwt: string; apiKey: string; _mcpUrl?: string }, toolName: string, args: Record<string, unknown>) {
  const base = creds._mcpUrl ?? DEFAULT_MCP_URL
  const res = await fetch(`${base}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${creds.jwt}`,
      'X-API-Key': creds.apiKey,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 9999, method: 'tools/call', params: { name: toolName, arguments: args } }),
    signal: AbortSignal.timeout(30_000),
  })
  return res.json()
}

export async function GET(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const tool = searchParams.get('tool') ?? ''

  // migration 和 aiConfig 不需要 Patisco 連線，提前處理
  if (tool === 'migration') {
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(process.env.DATABASE_URL!)
    const execRaw = (q: string) => {
      const t = Object.assign([q], { raw: [q] }) as unknown as TemplateStringsArray
      return (sql as unknown as (t: TemplateStringsArray) => Promise<unknown[]>)(t)
    }
    const stmts = [
      `ALTER TABLE "PO_SupplierPI" ADD COLUMN IF NOT EXISTS "patiscoCreatedAt" TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE "PO_Order" ADD COLUMN IF NOT EXISTS "salesOrderId" INTEGER REFERENCES "SLS_Order"("id") ON DELETE SET NULL`,
      `CREATE INDEX IF NOT EXISTS "PO_Order_salesOrderId_idx" ON "PO_Order"("salesOrderId")`,
      `ALTER TABLE "SYS_PatiscoConfig" ADD COLUMN IF NOT EXISTS "syncEnabled" BOOLEAN NOT NULL DEFAULT true`,
      `ALTER TABLE "SLS_ShipmentItem" ADD COLUMN IF NOT EXISTS "cartons" INTEGER`,
      `ALTER TABLE "SLS_ShipmentItem" ADD COLUMN IF NOT EXISTS "grossWeightKg" NUMERIC`,
      `ALTER TABLE "SLS_ShipmentItem" ADD COLUMN IF NOT EXISTS "netWeightKg" NUMERIC`,
      `ALTER TABLE "SLS_ShipmentItem" ADD COLUMN IF NOT EXISTS "cbm" NUMERIC`,
      `ALTER TABLE "SLS_Shipment" ADD COLUMN IF NOT EXISTS "packingListNo" TEXT`,
      `ALTER TABLE "SLS_Shipment" ADD COLUMN IF NOT EXISTS "commercialInvNo" TEXT`,
      `CREATE TABLE IF NOT EXISTS "CUS_CustomerProduct" (
        "id" SERIAL PRIMARY KEY,
        "customerId" INTEGER NOT NULL REFERENCES "CUS_Customer"("id") ON DELETE CASCADE,
        "productId" INTEGER NOT NULL REFERENCES "PRD_Product"("id") ON DELETE CASCADE,
        "lastUnitPrice" NUMERIC,
        "currencyCode" TEXT,
        "lastOrderDate" TIMESTAMP WITH TIME ZONE,
        "orderCount" INTEGER NOT NULL DEFAULT 1,
        "note" TEXT,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CUS_CustomerProduct_customerId_productId_key" UNIQUE ("customerId", "productId")
      )`,
      `CREATE INDEX IF NOT EXISTS "CUS_CustomerProduct_productId_idx" ON "CUS_CustomerProduct"("productId")`,
      `CREATE TABLE IF NOT EXISTS "SYS_KeyValue" (
        "key" TEXT PRIMARY KEY,
        "value" TEXT NOT NULL DEFAULT '',
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "UPS_ShipmentLog" (
        "id" SERIAL PRIMARY KEY,
        "trackingNumber" TEXT NOT NULL,
        "upsShipmentId" TEXT,
        "serviceCode" TEXT NOT NULL,
        "serviceName" TEXT,
        "piId" INTEGER,
        "piNo" TEXT,
        "originSnapshot" JSONB,
        "destinationSnapshot" JSONB,
        "packagesSnapshot" JSONB,
        "declaredValue" NUMERIC,
        "declaredCurrency" TEXT,
        "chargedAmount" NUMERIC,
        "chargedCurrency" TEXT,
        "labelBase64" TEXT,
        "labelFormat" TEXT DEFAULT 'GIF',
        "pickupConfirmationNo" TEXT,
        "pickupReadyTime" TIMESTAMP WITH TIME ZONE,
        "pickupCloseTime" TIMESTAMP WITH TIME ZONE,
        "pickupScheduledDate" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdByUserId" INTEGER
      )`,
      `CREATE INDEX IF NOT EXISTS "UPS_ShipmentLog_trackingNumber_idx" ON "UPS_ShipmentLog"("trackingNumber")`,
      `CREATE INDEX IF NOT EXISTS "UPS_ShipmentLog_piNo_idx" ON "UPS_ShipmentLog"("piNo")`,
    ]
    const migResult: string[] = []
    for (const stmt of stmts) {
      try {
        await execRaw(stmt)
        migResult.push(`OK: ${stmt.substring(0, 80)}`)
      } catch (e) {
        migResult.push(`ERR: ${(e as Error).message}`)
      }
    }
    return NextResponse.json({ migration: migResult })
  }

  const creds = await patiscoLogin(prisma)
  if (!creds) {
    return NextResponse.json({ error: 'Patisco login failed — 請確認租戶 Patisco 設定是否完整' }, { status: 503 })
  }

  let result: unknown

  switch (tool) {
    // ── raw：原始 MCP 回傳，不走 mcpCall 解析，用來確認實際格式 ──────────
    case 'raw': {
      const name = searchParams.get('name') ?? 'getPIs'
      const rawArgs: Record<string, unknown> = {}
      searchParams.forEach((v, k) => { if (k !== 'tool' && k !== 'name') rawArgs[k] = v })
      result = await rawMcpCall(creds, name, rawArgs)
      break
    }
    // ── getPIs：走解析後結果 ──────────────────────────────────────────────
    case 'getPIs': {
      const status = searchParams.get('status') ?? undefined
      const type   = searchParams.get('type')   ?? undefined
      const first  = Number(searchParams.get('first') ?? '10')
      result = await getPIs(creds, {
        filter: { ...(status ? { Status: status } : {}), ...(type ? { Type: type } : {}) },
        first,
        offset: 0,
      })
      break
    }
    case 'getBuyers': {
      result = await getBuyers(creds, { first: 5 })
      break
    }
    case 'searchBuyers': {
      const query = searchParams.get('query') ?? ''
      result = await searchBuyers(creds, query)
      break
    }
    case 'getBuyerCategories': {
      const buyerId = searchParams.get('buyerId') ?? ''
      const catalogId = searchParams.get('catalogId') ?? ''
      result = await getBuyerCategories(creds, buyerId, catalogId)
      break
    }
    case 'getBuyerCatalogs': {
      const buyerId = searchParams.get('buyerId') ?? ''
      const first = Number(searchParams.get('first') ?? '10')
      result = await getBuyerCatalogs(creds, { buyerId, first })
      break
    }
    case 'getBuyerCategoryProducts': {
      const buyerId = searchParams.get('buyerId') ?? ''
      const catalogId = searchParams.get('catalogId') ?? ''
      const categoryId = searchParams.get('categoryId') ?? undefined
      const first = Number(searchParams.get('first') ?? '5')
      result = await getBuyerCategoryProducts(creds, { buyerId, catalogId, categoryId, first })
      break
    }
    case 'getBuyerProductDetail': {
      const buyerId = searchParams.get('buyerId') ?? ''
      const catalogId = searchParams.get('catalogId') ?? ''
      const productId = searchParams.get('productId') ?? ''
      result = await getBuyerProductDetail(creds, { buyerId, catalogId, productId })
      break
    }
    case 'listOrderCopies': {
      const status = searchParams.get('status') ?? '0'
      const first = Number(searchParams.get('first') ?? '0')
      const offset = Number(searchParams.get('offset') ?? '20')
      result = await listOrderCopies(creds, { status, first, offset })
      break
    }
    // ── listTools：查 MCP 所有工具清單+schema（debug 用）─────────────────────
    case 'listTools': {
      result = await listTools(creds)
      break
    }
    // ── aiConfig：確認 AI 設定是否完整 ─────────────────────────────────────
    case 'aiConfig': {
      const user = await prisma.sYS_User.findFirst({
        orderBy: { id: 'asc' },
        select: { id: true, aiProvider: true, encryptedAiKey: true, aiParseModel: true },
      })
      if (!user) {
        result = { ok: false, error: 'no SYS_User found' }
        break
      }
      const hasKey = !!user.encryptedAiKey
      let decryptOk = false
      let keyPreview = ''
      if (hasKey) {
        try {
          const { decrypt } = await import('@/lib/crypto')
          const decrypted = decrypt(user.encryptedAiKey!)
          decryptOk = true
          keyPreview = decrypted.substring(0, 8) + '...'
        } catch (e) {
          decryptOk = false
          keyPreview = `decrypt error: ${(e as Error).message}`
        }
      }
      // 計算需要 AI 豐富化的商品數（name == modelNo 視為 fallback，需重跑）
      const totalProducts = await prisma.pRD_Product.count({ where: { isActive: true } })
      const namedUnnamed  = await prisma.pRD_Product.count({ where: { isActive: true, name: '未命名商品' } })
      const noHts         = await prisma.pRD_Product.count({ where: { isActive: true, htsCode: null } })
      // raw SQL 查 name == "modelNo" 的數量（Prisma 不支援跨欄位比較）
      const { neon } = await import('@neondatabase/serverless')
      const sql = neon(process.env.DATABASE_URL!)
      const rawRows = await sql`SELECT COUNT(*)::int as cnt FROM "PRD_Product" WHERE "isActive" = true AND "modelNo" IS NOT NULL AND "name" = "modelNo"`
      const nameIsModelNo = (rawRows[0] as { cnt: number }).cnt ?? 0
      result = {
        ok: true,
        userId: user.id,
        aiProvider: user.aiProvider ?? null,
        aiModel: user.aiParseModel ?? '(default)',
        hasEncryptedKey: hasKey,
        decryptOk,
        keyPreview: decryptOk ? keyPreview : keyPreview,
        products: { total: totalProducts, namedUnnamed, nameIsModelNo, noHts },
        actionNeeded: nameIsModelNo + namedUnnamed + noHts > 0,
      }
      break
    }
    case 'getOrderDetail': {
      const orderId = searchParams.get('orderId') ?? ''
      result = await getOrderDetail(creds, orderId)
      break
    }
    case 'getOrderProducts': {
      const orderId = searchParams.get('orderId') ?? ''
      const page = Number(searchParams.get('page') ?? '1')
      result = await getOrderProducts(creds, orderId, page)
      break
    }
    case 'listProformaInvoices': {
      const page = Number(searchParams.get('page') ?? '1')
      result = await listProformaInvoices(creds, page)
      break
    }
    case 'listProformaInvoiceCopies': {
      const page = Number(searchParams.get('page') ?? '1')
      result = await listProformaInvoiceCopies(creds, page)
      break
    }
    default:
      return NextResponse.json({ error: `unknown tool: ${tool}`, available: ['raw','listTools','aiConfig','migration','getPIs','getBuyers','searchBuyers','getBuyerCategories','getBuyerCatalogs','getBuyerCategoryProducts','getBuyerProductDetail','listOrderCopies','getOrderDetail','getOrderProducts','listProformaInvoices','listProformaInvoiceCopies'] })
  }

  return NextResponse.json(result)
}
