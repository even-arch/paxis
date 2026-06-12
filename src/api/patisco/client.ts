/**
 * Patisco MCP Gateway Client
 * 協定：JSON-RPC 2.0 over HTTP POST
 * 端點：https://mcp.patisco.com
 *
 * 新版 API（2026-06）工具清單：
 *   listProformaInvoices / listProformaInvoiceCopies
 *   listPurchaseOrders   / listPurchaseOrderCopies
 *   listDeliveryOrders
 *   getOrderDetail / getOrderProducts（orderId 參數，回傳 { detail, products, ... }）
 *   getDeliveryOrderDetail（需 documentType: "packingList"|"commercialInvoice"）
 *   getOrderCopyDetail / getOrderCopyProducts
 *   health
 *
 * 已移除的舊工具（已保留 stub 供舊呼叫端 graceful degrade）：
 *   getPIs → listProformaInvoices
 *   getShipments / getShipmentDetail → listDeliveryOrders / getDeliveryOrderDetail
 *   listOrderCopies → listProformaInvoiceCopies / listPurchaseOrderCopies
 *   getBuyers / getSellers → 已不存在，公司資料改從 order detail 中提取
 */

import type { PrismaClient } from '@prisma/client'

// 預設值（DB 設定優先，環境變數備援）
// 路徑須包含 /mcp（MCP 協定端點）
const DEFAULT_MCP_URL = process.env.PATISCO_MCP_URL ?? 'https://mcp.patisco.com/mcp'

// ─── MCP Session 管理 ─────────────────────────────────────────────────────────
// MCP 協定要求先 POST initialize，從回應 Header 取得 mcp-session-id，
// 後續所有 tools/call 都需帶此 Header。這裡用 in-process Map 快取，
// 避免同一 sync run 重複 initialize。

const _sessions = new Map<string, string>() // key: mcpUrl → sessionId

async function ensureMcpSession(mcpUrl: string, jwt: string, apiKey: string): Promise<string | null> {
  const existing = _sessions.get(mcpUrl)
  if (existing) return existing

  try {
    const res = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${jwt}`,
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 0,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'paxis', version: '1.0' },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const sessionId = res.headers.get('mcp-session-id')
    if (sessionId) {
      _sessions.set(mcpUrl, sessionId)
      return sessionId
    }
    // Session-less server — 繼續不帶 session ID
    return null
  } catch (err) {
    console.warn('[patisco] MCP initialize 失敗', err)
    return null
  }
}

/** 清除 session 快取（換帳號 / JWT 過期時呼叫） */
export function clearMcpSessions() {
  _sessions.clear()
}

// ─── 型別定義 ─────────────────────────────────────────────────────────────────

export type PatiscoCredentials = {
  jwt: string
  apiKey: string
  userId: string
  tenantId: string
}

export type PatiscoPI = {
  id: string   // 實際回傳是小寫
  no: string
  status: string | number  // 0 = Editing, 1 = Confirmed
  type?: string | number   // 2 = PI
  buyer?: string
  seller?: string
  priceText?: string
  payment?: string | number  // TradingTerm code（13=FOB, 14=FOR, 2=CIF…）
  createdDate: string
  Products?: PatiscoPIProduct[]
}

export type PatiscoPIProduct = {
  ID: string           // 明細 ID
  SKU?: string
  ModelNo?: string
  Specification?: string
  Note?: string | null   // 產品備註（getOrderProducts 回傳）
  Notes?: string | null  // 備用備註欄位
  Quantity: string | number  // API 回傳 string
  MOQ?: string | null
  Price?: string | number
  CurrencyCode?: string
  Unit?: string
  NetWeight?: string | null
  GrossWeight?: string | null
  UnitPerCarton?: string | null
  Length?: string | null
  Width?: string | null
  Height?: string | null
}

export type PatiscoExtraCharge = {
  name: string
  type: string   // "1"=固定額, "2"=百分比
  amount: string
}

// ─── Patisco code 對照表（Fix_Var sheet）────────────────────────────────────

/** Patisco SizeUnit code → 單位名稱 */
export const PATISCO_SIZE_UNIT: Record<number, string> = {
  0: 'ft', 1: 'm', 2: 'in', 3: 'cm',
}

/** Patisco WeightUnit code → 單位名稱 */
export const PATISCO_WEIGHT_UNIT: Record<number, string> = {
  0: 'lb', 1: 'kg',
}

/** Patisco TradingTerm code → 標準名稱（Fix_Var 第 2 欄） */
export const PATISCO_TRADE_TERMS: Record<number, string> = {
  1: 'CFR', 2: 'CIF', 3: 'CIP', 4: 'DAF', 5: 'DDP',
  6: 'DDU', 7: 'DEQ', 8: 'DES', 9: 'EXW', 10: 'FAS',
  11: 'FCA', 12: 'FOA', 13: 'FOB', 14: 'FOR', 15: 'FRC',
  16: 'PORT', 17: 'W/O Term', 18: 'CNF', 19: 'CPT',
}

/** Patisco CurrencyCode number → ISO 代碼（Fix_Var 第 1 欄） */
export const PATISCO_CURRENCY: Record<number, string> = {
  1: 'ARS', 2: 'AUD', 3: 'BOB', 4: 'BRL', 5: 'CAD',
  6: 'CHF', 7: 'CLP', 8: 'CNY', 9: 'COP', 10: 'CRC',
  11: 'CZK', 12: 'DKK', 13: 'ECS', 14: 'EGP', 15: 'EUR',
  16: 'GBP', 17: 'HKD', 18: 'HUF', 19: 'IDR', 20: 'ILS',
  21: 'JPY', 22: 'KES', 23: 'KRW', 24: 'LKR', 25: 'MAD',
  26: 'MUR', 27: 'MXN', 28: 'MYR', 29: 'NOK', 30: 'NZD',
  31: 'PAB', 32: 'PHP', 33: 'PKR', 34: 'PLN', 35: 'RUB',
  36: 'SAR', 37: 'SEK', 38: 'SGD', 39: 'SKK', 40: 'THB',
  41: 'TRL', 42: 'TRY', 43: 'TWD', 44: 'USD', 45: 'VEB',
  46: 'ZAR', 47: 'ZWD', 48: 'RMB', 49: 'INR',
}

/** Patisco CurrencyCode string/number → ISO 代碼（找不到回傳 fallback） */
export function resolvePatiscoCurrency(code: string | number | undefined, fallback = 'USD'): string {
  if (!code) return fallback
  const n = parseInt(String(code), 10)
  return PATISCO_CURRENCY[n] ?? fallback
}

export type PatiscoOrderWithProducts = {
  ID: string
  No: string
  CurrencyCode?: string
  Products: PatiscoPIProduct[]
}

/** listDeliveryOrders 清單項目（實際回傳格式） */
export type PatiscoShipment = {
  id: string
  no: string
  buyer?: string           // 買家名稱（字串，非物件）
  expiredDate?: string | null
  createdDate?: string
  completedDate?: string | null
  copyId?: string
  tradingCode?: string
  port?: string
}

/** getDeliveryOrderDetail 的 packings 項目（packingList 版） */
export type PatiscoShipmentPackingPL = {
  id?: string
  type?: string
  sourceOrderID?: string
  sourceProductID?: string
  sourceOrderNo?: string
  sku?: string
  modelNo?: string
  specification?: string
  sizeUnit?: string
  length?: string; height?: string; width?: string
  totalDimension?: string; itemTotalDimension?: string
  imperialTotalDimension?: string; itemImperialTotalDimension?: string
  weightUnit?: string
  netWeight?: string; totalNetWeight?: string
  grossWeight?: string; totalGrossWeight?: string
  unitPerCarton?: string
  unit?: string
  quantity?: string; totalQuantity?: string; sourceQuantity?: string
  quantityOfCartons?: string
  isSameCase?: string
  dimension?: string | null
  caseNumbers?: Array<{ id?: string; caseNo1?: string; caseNo2?: string; identificationCode?: string | null }>
}

/** getDeliveryOrderDetail 的 packings 項目（commercialInvoice 版） */
export type PatiscoShipmentPackingCI = {
  id?: string
  no?: string
  sourceOrderID?: string
  sourceProductID?: string
  sourceOrderNo?: string
  sku?: string
  modelNo?: string
  specification?: string
  currencyCode?: string
  price?: string
  quantity?: string
  unit?: string
  amount?: string
}

/** getDeliveryOrderDetail 回傳（共用，欄位依 documentType 有差異） */
export type PatiscoShipmentDetail = {
  id: string
  isCopy?: string
  no: string
  status?: string
  createdBy?: string
  createdDate?: string
  expiredDate?: string | null
  shippedBy?: string
  shipDate?: string
  shipNo?: string | null
  from?: string
  to?: string
  shipment?: string      // 純文字格式的收貨人資訊
  note?: string | null
  marks?: string | null
  termAndCondition?: string | null
  currencyCode?: string
  tradingCode?: string
  port?: string
  buyer?: {
    name?: string
    address?: string
    city?: string
    countryCode?: string
    postalCode?: string
    phoneNo?: string
    email?: string
    fax?: string
    taxId?: string
    buyerId?: string     // Patisco 唯一客戶識別碼
  }
  shippingInfo?: {
    shipVia?: string | null
    address?: string
    city?: string
    countryCode?: string
    postalCode?: string
    phoneNo?: string
    receiver?: string
  }
  orders?: Array<{
    id?: string; no?: string; expiredDate?: string | null
    totalDimension?: string; imperialTotalDimension?: string
    totalQuantity?: string; totalGrossWeight?: string; totalNetWeight?: string
    amount?: string; caseNumber?: string; seq?: string | null
  }>
  packings?: (PatiscoShipmentPackingPL | PatiscoShipmentPackingCI)[]
  extraCharges?: Array<{
    id?: string; sourceOrderNo?: string; name?: string
    type?: string; amount?: string; charge?: string; isBeSeen?: string
  }>
  exchangeRate?: { roundingType?: string | null; accurateTo?: string | null; value?: string | null; oriCurrency?: string | null; toCurrency?: string | null }
  copyExchangeRate?: { roundingType?: string | null; accurateTo?: string | null; value?: string | null }
  total?: {
    amount?: string | null
    totalPriceOfProducts?: string | null
    additionalCharges?: string | null
    currencyCode?: string
    quantityOfCartons?: string | null
    content?: Array<{ unit?: string; quantity?: string }>
    totalNetWeight?: string | null
    totalGrossWeight?: string | null
    totalDimension?: string | null
    imperialTotalDimension?: string | null
  }
}

// ─── 認證 ─────────────────────────────────────────────────────────────────────

/**
 * 取得 Patisco 認證憑證
 * 優先順序：
 *   1. DB Token 模式（直接貼 JWT + API Key）→ JWT 未過期才用
 *   2. DB 帳密模式（自動登入）
 *   3. 環境變數備援
 */
/**
 * 取得 Patisco 認證憑證
 * @param tenantPrisma - 傳入 getTenantDb() 取得的租戶 PrismaClient（推薦）。
 *   若不傳，退回全域 DATABASE_URL（cron/admin debug 等無 session 情境）。
 */
export async function patiscoLogin(
  tenantPrisma?: PrismaClient,
): Promise<(PatiscoCredentials & { _mcpUrl: string }) | null> {
  try {
    const db = tenantPrisma ?? (await import('@/lib/db')).prisma
    const { decrypt } = await import('@/lib/crypto')

    const config = await db.sYS_PatiscoConfig.findFirst({
      where: { isActive: true },
      orderBy: { id: 'desc' },
    })

    if (config) {
      const mcpUrl = config.mcpUrl

      // ── 模式 1：Token 模式（JWT + API Key 直接使用）──────────────────────
      if (config.encryptedJwt && config.apiKey) {
        // jwtExpiresAt 為 null 視為「不知道有效期，嘗試解析 JWT payload」
        const now = new Date()
        let isExpired = false
        if (config.jwtExpiresAt) {
          isExpired = config.jwtExpiresAt < now
        } else {
          // 未存 expiry，從 JWT payload 自行判斷
          const jwt = decrypt(config.encryptedJwt)
          const expiry = parseJwtExpiry(jwt)
          if (expiry) {
            isExpired = expiry < now
            // 順便寫回 DB（fire-and-forget，不影響主流程）
            db.sYS_PatiscoConfig.update({
              where: { id: config.id },
              data: { jwtExpiresAt: expiry },
            }).catch(() => {})
          }
        }

        if (!isExpired) {
          const jwt = decrypt(config.encryptedJwt)
          return {
            jwt,
            apiKey: config.apiKey,
            userId: config.userId ?? '',
            tenantId: '',
            _mcpUrl: mcpUrl,
          }
        }
        console.warn('[patisco] JWT 已過期，嘗試帳密重新登入')
      }

      // ── 模式 2：帳密模式（自動登入取得新 JWT）───────────────────────────
      if (config.username && config.encryptedPass) {
        const password = decrypt(config.encryptedPass)
        const result = await doLogin(mcpUrl, config.username, password)
        if (result) {
          // 更新 DB 的 JWT 快取
          const expiresAt = parseJwtExpiry(result.jwt)
          await db.sYS_PatiscoConfig.update({
            where: { id: config.id },
            data: {
              encryptedJwt: (await import('@/lib/crypto')).encrypt(result.jwt),
              apiKey: result.apiKey,
              userId: result.userId,
              jwtExpiresAt: expiresAt,
            },
          })
          return { ...result, _mcpUrl: mcpUrl }
        }
        return null
      }
    }
  } catch (err) {
    console.warn('[patisco] DB 讀取失敗，嘗試環境變數', err)
  }

  // ── 模式 3：環境變數備援 ─────────────────────────────────────────────────
  const username = process.env.PATISCO_USERNAME ?? ''
  const password = process.env.PATISCO_PASSWORD ?? ''
  const mcpUrl = DEFAULT_MCP_URL
  if (!username || !password) {
    console.warn('[patisco] 未設定任何 Patisco 憑證，跳過')
    return null
  }
  const result = await doLogin(mcpUrl, username, password)
  return result ? { ...result, _mcpUrl: mcpUrl } : null
}

/** 實際執行登入（Email / Login ID + 密碼） */
async function doLogin(mcpUrl: string, loginId: string, password: string): Promise<PatiscoCredentials | null> {
  try {
    // auth 端點在根域名，不在 MCP 子路徑下（如 /mcp）
    const origin = new URL(mcpUrl).origin
    const res = await fetch(`${origin}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, password }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.error('[patisco] 登入失敗', res.status, await res.text())
      return null
    }
    return await res.json() as PatiscoCredentials
  } catch (err) {
    console.error('[patisco] 登入錯誤', err)
    return null
  }
}

/** 解析 JWT exp 欄位，回傳到期時間 */
function parseJwtExpiry(jwt: string): Date | null {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString())
    if (payload.exp) return new Date(payload.exp * 1000)
  } catch { /* ignore */ }
  return null
}

// ─── JSON-RPC 基礎呼叫 ────────────────────────────────────────────────────────

let _reqId = 1

async function mcpCall<T>(
  creds: PatiscoCredentials & { _mcpUrl?: string },
  tool: string,
  args: Record<string, unknown> = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const base = (creds._mcpUrl ?? DEFAULT_MCP_URL).replace(/\/$/, '')
  const sessionId = await ensureMcpSession(base, creds.jwt, creds.apiKey)
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${creds.jwt}`,
      'X-API-Key': creds.apiKey,
    }
    if (sessionId) headers['mcp-session-id'] = sessionId
    const res = await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: _reqId++,
        method: 'tools/call',
        params: { name: tool, arguments: args },
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` }
    }

    // 伺服器回傳 SSE 格式（event: message\ndata: {...}）或純 JSON
    // 統一用 text() 讀取，再提取 data: 行
    const raw = await res.text()
    let json: Record<string, unknown>
    try {
      // SSE 格式：取最後一個 data: 行（避免 ping 等 heartbeat 行干擾）
      const dataLine = raw.split('\n').filter(l => l.startsWith('data:')).pop()
      const jsonStr = dataLine ? dataLine.replace(/^data:\s*/, '') : raw
      json = JSON.parse(jsonStr)
    } catch {
      return { ok: false, error: `無法解析回應：${raw.slice(0, 200)}` }
    }

    if (json.error) {
      const err = json.error as Record<string, unknown>
      // session 過期或無效 → 清除快取讓下次重新 initialize
      if (typeof err.message === 'string' && /session/i.test(err.message)) {
        _sessions.delete(base)
      }
      return { ok: false, error: (err.message as string) ?? JSON.stringify(err) }
    }

    // MCP 回傳格式，依優先順序：
    // 1. result.structuredContent（新版 MCP structured output）
    // 2. result.content[0].text（標準 MCP text content，JSON string）
    // 3. result 本身（直接回傳物件，部分自架 MCP Server）
    const result = json.result as Record<string, unknown> | undefined
    let data: unknown
    if (result?.structuredContent !== undefined) {
      data = result.structuredContent
    } else if (Array.isArray(result?.content) && (result.content as unknown[])[0] && typeof ((result.content as unknown[])[0] as Record<string, unknown>).text === 'string') {
      try {
        data = JSON.parse(((result.content as unknown[])[0] as Record<string, unknown>).text as string)
      } catch {
        data = ((result.content as unknown[])[0] as Record<string, unknown>).text
      }
    } else {
      data = result
    }
    return { ok: true, data: data as T }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[patisco] ${tool} 呼叫失敗：${msg}`)
    return { ok: false, error: msg }
  }
}

// ─── 業務工具封裝 ──────────────────────────────────────────────────────────────

type GetPIsArgs = {
  filter?: {
    Status?: string    // '3' = 已確認
    Type?: string      // '2' = PI
    No?: string        // 單號模糊搜尋
    DateFrom?: string  // ISO date
    DateTo?: string
  }
  first?: number   // 取多少筆（default 25）
  offset?: number  // 跳過幾筆（分頁）
  orderBy?: string // 'CreatedDate_DESC'
}

type GetPIsResult = {
  items: PatiscoPI[]
  total?: number
}

/**
 * 解析 getPIs 的純文字回傳（Patisco 有時回傳 content[0].text 純文字而非 structuredContent）
 * 格式：每筆以 "---" 分隔，每行 "Key: Value"
 */
function parsePIsText(text: string): PatiscoPI[] {
  const blocks = text.split(/\n---\n?/).filter(b => b.trim())
  return blocks.map(block => {
    const get = (key: string) => {
      const m = block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
      return m ? m[1].trim() : undefined
    }
    const statusRaw = get('Status') ?? ''
    const status = statusRaw === 'Confirmed' ? '1' : statusRaw === 'Editing' ? '0' : statusRaw
    return {
      id:          get('ID') ?? '',
      no:          get('No') ?? '',
      status,
      type:        get('Type'),
      buyer:       get('Buyer'),
      seller:      get('Seller'),
      priceText:   get('Price'),
      payment:     get('Payment'),
      createdDate: get('Created') ?? '',
    } satisfies PatiscoPI
  }).filter(pi => pi.id && pi.no)
}

/** 查詢 Patisco PI 列表 */
export async function getPIs(
  creds: PatiscoCredentials,
  args: GetPIsArgs = {},
) {
  const res = await mcpCall<GetPIsResult>(creds, 'getPIs', args as Record<string, unknown>)
  if (!res.ok) return res

  // structuredContent 路徑：已有 items 陣列，直接用
  if (Array.isArray((res.data as GetPIsResult)?.items)) return res

  // 純文字 fallback：content[0].text 是 "No: ...\nID: ...\n---\n..." 格式
  if (typeof res.data === 'string') {
    const items = parsePIsText(res.data as unknown as string)
    return { ok: true as const, data: { items, total: items.length } }
  }

  return res
}

/**
 * 解析 getOrderProducts 純文字回傳
 * 格式：
 *   Order E2620095 | Items: 1 | Products: 1
 *     1. SKU: 0201050 | ModelNo: - | Qty: 200 PC | Price: 49.0000 43
 *        Spec: ...
 *   ---
 */
function parseOrderProductsText(text: string): PatiscoOrderWithProducts[] {
  const orders: PatiscoOrderWithProducts[] = []
  const blocks = text.split(/\n---\n?/).filter(b => b.trim())

  for (const block of blocks) {
    const headerMatch = block.match(/^Order\s+(\S+)\s*\|/)
    const orderNo = headerMatch?.[1] ?? ''

    const products: PatiscoPIProduct[] = []
    const lines = block.split('\n')

    for (let i = 0; i < lines.length; i++) {
      // "  1. SKU: 0201050 | ModelNo: - | Qty: 200 PC | Price: 49.0000 43"
      const itemMatch = lines[i].match(/^\s+\d+\.\s+SKU:\s*(\S+)\s*\|\s*ModelNo:\s*([^|]+)\s*\|\s*Qty:\s*([\d.]+)\s*(\S+)\s*\|\s*Price:\s*([\d.]+)/)
      if (!itemMatch) continue

      const sku = itemMatch[1] === '-' ? undefined : itemMatch[1]
      const modelNo = itemMatch[2].trim() === '-' ? undefined : itemMatch[2].trim()
      const qty = itemMatch[3]
      const unit = itemMatch[4]
      const price = itemMatch[5]

      // next line may be "   Spec: ..."
      let spec = ''
      let j = i + 1
      while (j < lines.length && /^\s{5,}/.test(lines[j]) && !lines[j].match(/^\s+\d+\.\s+SKU:/)) {
        const specLine = lines[j].replace(/^\s+Spec:\s*/, '').trim()
        if (specLine) spec += (spec ? '\n' : '') + specLine
        j++
      }

      products.push({
        ID: '',
        SKU: sku,
        ModelNo: modelNo,
        Specification: spec || undefined,
        Quantity: qty,
        Unit: unit,
        Price: price,
      })
    }

    orders.push({ ID: '', No: orderNo, Products: products })
  }

  return orders
}

export type GetOrderProductsResult = {
  // 新版：paginated items（PatiscoOrderDetailItem[]）
  items?: PatiscoOrderDetailItem[]
  page?: number
  pageSize?: number
  totalCount?: number
  totalPages?: number
  hasNextPage?: boolean
  autoExpanded?: boolean
  // 舊版 fallback
  orders?: PatiscoOrderWithProducts[]
}

/** 查詢 PI/PO 的商品明細
 * 新版參數：{ orderId, page? }
 * 回傳：paginated items（PatiscoOrderDetailItem[]）或舊版 orders[]
 */
export async function getOrderProducts(
  creds: PatiscoCredentials,
  orderId: string,
  page = 1,
) {
  const res = await mcpCall<GetOrderProductsResult>(creds, 'getOrderProducts', { orderId, page })
  if (!res.ok) return res
  // 新版回傳 items[]
  if (Array.isArray(res.data?.items)) return res
  // 舊版 fallback：orders[]
  if (Array.isArray(res.data?.orders)) return res
  // 純文字 fallback（舊版）
  if (typeof res.data === 'string') {
    const orders = parseOrderProductsText(res.data as unknown as string)
    return { ok: true as const, data: { orders } }
  }
  return res
}

type GetShipmentsArgs = {
  filter: {
    BuyerID: string    // 必填
    DateFrom: string   // 必填，YYYY-MM-DD
    DateTo: string     // 必填，YYYY-MM-DD
    Status?: string    // 出貨狀態
    SourceOrderID?: string  // 過濾特定訂單
    SKU?: string
  }
  first?: number   // 起始索引（0-based）
  offset?: number  // 取幾筆（default 50）
}

export type GetShipmentsResult = {
  items: PatiscoShipment[]
  totalCount?: string | number
  pageCount?: number
}

export type GetShipmentDetailResult = {
  item?: PatiscoShipmentDetail
}

// ─── Order Detail 型別 ────────────────────────────────────────────────────────

export type PatiscoOrderDetail = {
  id: string
  status: string
  payment?: string    // TradingTerm code（13=FOB, 14=FOR…）
  isPaid?: string
  createdDate?: string
  buyer?: {
    name?: string
    address?: string
    city?: string
    countryCode?: string
    postalCode?: string
    phoneNo?: string
    email?: string
    fax?: string
    taxId?: string
  }
  seller?: {
    name?: string
    address?: string
    city?: string
    countryCode?: string
    postalCode?: string
    phoneNo?: string
    email?: string
    fax?: string
    taxId?: string
  }
  shippingInfo?: {
    address?: string
    city?: string
    countryCode?: string
    receiver?: string
  }
  extraCharges?: PatiscoExtraCharge[]
  priceAdjustmants?: Array<{ name?: string; type?: string; amount?: string }>
  items?: PatiscoOrderDetailItem[]
  total?: {
    amount?: string
    totalPriceOfProducts?: string
    additionalCharges?: string
    extraChargeG1?: string
  }
}

/** getOrderDetail.items 用小寫鍵（PI 和 PO 共用） */
export type PatiscoOrderDetailItem = {
  id?: string
  sku?: string
  modelNo?: string
  specification?: string
  note?: string | null
  sizeUnit?: string
  length?: string
  height?: string
  width?: string
  weightUnit?: string
  netWeight?: string
  grossWeight?: string
  unitPerCarton?: string
  currencyCode?: string
  unit?: string
  moq?: string
  price?: string
  quantity?: string
  attachmentId?: string
  totalDimension?: string
  imperialTotalDimension?: string
}

export type GetOrderDetailResult = {
  // 新版 API 回傳 detail（同時保留 order 做 backward compat）
  detail?: PatiscoOrderDetail
  order?: PatiscoOrderDetail   // 舊版欄位，仍可能出現
  products?: {
    items: PatiscoOrderDetailItem[]
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
    hasNextPage: boolean
    autoExpanded: boolean
  }
  priceAdjustments?: PatiscoExtraCharge[]
  price?: { amount?: string; totalPriceOfProducts?: string } | null
}

/** 取得 PI/PO 完整 header 資料（含 extraCharges、payment/Incoterm、total） */
export async function getOrderDetail(
  creds: PatiscoCredentials,
  orderId: string,
) {
  return mcpCall<GetOrderDetailResult>(creds, 'getOrderDetail', { orderId })
}

/** 從 getOrderDetail 回傳中取出 order header（相容新舊格式） */
export function extractOrderDetail(data: GetOrderDetailResult | undefined): PatiscoOrderDetail | null {
  if (!data) return null
  return data.detail ?? data.order ?? null
}

// ─── 新版 List 工具 ──────────────────────────────────────────────────────────

export type PatiscoListResult<T> = {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
  autoExpanded: boolean
}

/** 列出我方發出的 PI 正本（listProformaInvoices） */
export async function listProformaInvoices(creds: PatiscoCredentials, page = 1) {
  return mcpCall<PatiscoListResult<PatiscoPI>>(creds, 'listProformaInvoices', { page })
}

/** 列出我方收到的 PI 副本（供應商發給我方）（listProformaInvoiceCopies） */
export async function listProformaInvoiceCopies(creds: PatiscoCredentials, page = 1) {
  return mcpCall<PatiscoListResult<PatiscoOrderCopy>>(creds, 'listProformaInvoiceCopies', { page })
}

/** 列出我方發出的 PO 正本（listPurchaseOrders） */
export async function listPurchaseOrders(creds: PatiscoCredentials, page = 1) {
  return mcpCall<PatiscoListResult<PatiscoOrderCopy>>(creds, 'listPurchaseOrders', { page })
}

/** 列出我方收到的 PO 副本（客戶發給我方）（listPurchaseOrderCopies） */
export async function listPurchaseOrderCopies(creds: PatiscoCredentials, page = 1) {
  return mcpCall<PatiscoListResult<PatiscoOrderCopy>>(creds, 'listPurchaseOrderCopies', { page })
}

/** 列出進行中的出貨單（listDeliveryOrders，Status=0） */
export async function listDeliveryOrders(creds: PatiscoCredentials, page = 1) {
  return mcpCall<PatiscoListResult<PatiscoShipment>>(creds, 'listDeliveryOrders', { page })
}

/** 取得出貨文件明細（需指定文件類型） */
export async function getDeliveryOrderDetail(
  creds: PatiscoCredentials,
  shipmentId: string,
  documentType: 'packingList' | 'commercialInvoice',
) {
  // API 實際上直接回傳 PatiscoShipmentDetail，不包在 detail/item 裡面
  // 但保留 detail/item 欄位作為 fallback（型別 union）
  return mcpCall<PatiscoShipmentDetail & { detail?: PatiscoShipmentDetail; item?: PatiscoShipmentDetail }>(
    creds, 'getDeliveryOrderDetail', { shipmentId, documentType }
  )
}

// ─── Buyer 型別（已不存在獨立 getBuyers API，保留型別供相容）──────────────

export type PatiscoBuyer = {
  ID: string
  Name: string
  Address?: string | null
  City?: string | null
  CountryCode?: string | null
  PostalCode?: string | null
  PhoneNo?: string | null
  FAX?: string | null
  TaxID?: string | null
  EMail?: string | null
  ContactPerson?: string | null
  Note?: string | null
  CatlogID?: string | null   // Patisco 的 typo，型錄 ID（有 CatlogID 才有商品型錄）
  TradingSetupID?: string | null
  TradingSetupName?: string | null
  CreatedBy?: string | null
  CreatedDate?: string | null
  Invitation?: { ID?: string; Status?: string; Inviter?: string; Date?: string; IsBeInvited?: string } | null
}

type GetBuyersArgs = {
  filter?: {
    ID?: string
    Name?: string
    InvitationStatus?: 'N/A' | '0' | '1'
    CountryCode?: string
  }
  orderBy?: string
  first?: number
  offset?: number
}

type GetBuyersResult = {
  items: PatiscoBuyer[]
  totalCount?: number
  pageCount?: number
}

/**
 * 解析 getBuyers 純文字回傳
 * 格式：Item 1: EverFriend Co., Ltd. (ID: 1642696543386542080) | Status: 1 | Contact: ...
 */
function parseBuyersText(text: string): PatiscoBuyer[] {
  const buyers: PatiscoBuyer[] = []
  for (const line of text.split('\n')) {
    const m = line.match(/Item\s+\d+:\s+(.+?)\s+\(ID:\s+(\d+)\)\s*\|\s*Status:\s*(\S+)/)
    if (!m) continue
    buyers.push({
      ID: m[2],
      Name: m[1].trim(),
    })
  }
  return buyers
}

/** @deprecated getBuyers 已在新版 MCP API 移除。公司資料改從 order detail 提取。 */
export async function getBuyers(
  _creds: PatiscoCredentials,
  _args: GetBuyersArgs = {},
): Promise<{ ok: false; error: string }> {
  console.warn('[patisco] getBuyers 已移除，請改用 listProformaInvoices 並從 order detail 提取 buyer 資料')
  return { ok: false, error: 'getBuyers: tool removed in new MCP API' }
}

/** @deprecated getShipments 已移除，請改用 listDeliveryOrders */
export async function getShipments(
  _creds: PatiscoCredentials,
  _args: GetShipmentsArgs,
): Promise<{ ok: false; error: string }> {
  console.warn('[patisco] getShipments 已移除，請改用 listDeliveryOrders')
  return { ok: false, error: 'getShipments: tool removed in new MCP API' }
}

/** @deprecated getShipmentDetail 已移除，請改用 getDeliveryOrderDetail */
export async function getShipmentDetail(
  _creds: PatiscoCredentials,
  _deliveryOrderId: string | number,
): Promise<{ ok: false; error: string }> {
  console.warn('[patisco] getShipmentDetail 已移除，請改用 getDeliveryOrderDetail')
  return { ok: false, error: 'getShipmentDetail: tool removed in new MCP API' }
}

/** @deprecated addBlankPIOrder 已移除（新版 API 為唯讀）*/
export async function addBlankPIOrder(
  _creds: PatiscoCredentials,
  _buyerId: string | number,
  _products: Array<{ ProductID: string | number; Quantity: number }> = [],
): Promise<{ ok: false; error: string }> {
  console.warn('[patisco] addBlankPIOrder 已移除，新版 MCP API 為唯讀')
  return { ok: false, error: 'addBlankPIOrder: tool removed in new MCP API (read-only)' }
}

/** 查詢所有工具清單（debug 用） */
export async function listTools(creds: PatiscoCredentials & { _mcpUrl?: string }) {
  const base = creds._mcpUrl ?? DEFAULT_MCP_URL
  try {
    const res = await fetch(`${base}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${creds.jwt}`,
        'X-API-Key': creds.apiKey,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: _reqId++, method: 'tools/list', params: {} }),
      signal: AbortSignal.timeout(10_000),
    })
    return await res.json()
  } catch {
    return null
  }
}

// ─── 商品目錄型別 ─────────────────────────────────────────────────────────────

export type PatiscoBuyerCategory = {
  id: string
  name: string
  parentId?: string | null
  sequence?: string
  children?: PatiscoBuyerCategory[]
}

export type PatiscoBuyerCatalogProduct = {
  id: string        // ProductID（型錄內部 ID，小寫）
  sku?: string
  modelNo?: string
  name?: string
  brand?: string
  unit?: string
  price?: string
  currencyCode?: string
  coverImageId?: string
  isEnableViewPrice?: boolean
  isEnableInQuery?: boolean
}

export type PatiscoProductDetail = {
  id: string
  sku?: string
  modelNo?: string
  name?: string
  specification?: string
  note?: string
  packaging?: string
  brand?: string
  unit?: string
  currencyCode?: string         // Patisco 內部 code，"44" = USD
  price?: string
  msrp?: string
  placeOfOrigin?: string
  warranty?: string
  certification?: string
  stock?: string

  // 尺寸（cm，sizeUnit="3"）
  sizeUnit?: string
  length?: string
  width?: string
  height?: string
  totalDimension?: string       // CBM
  imperialTotalDimension?: string

  // 重量（kg，weightUnit="1"）
  weightUnit?: string
  netWeight?: string
  grossWeight?: string
  unitPerCarton?: string

  priceCategories?: Array<{ moq: string; price: string }>
  attachments?: Array<{ id: string; name: string; type: string; extension: string; sequence: string }>
  categories?: Array<{ id: string; name: string; children?: unknown }>
  grouping?: { id: string }
  options?: unknown[]
}

// ─── 商品目錄工具 ─────────────────────────────────────────────────────────────

/** 取得買家的型錄列表（一個 buyer 可能有多個型錄） */
export async function getBuyerCatalogs(
  creds: PatiscoCredentials,
  args: {
    buyerId: string
    first?: number
    offset?: number
  },
) {
  return mcpCall<{
    items: Array<{ id: string; name: string; createdBy?: string; lastModifiedDate?: string }>
    totalCount?: number
  }>(creds, 'getBuyerCatalogs', {
    filter: { BuyerID: args.buyerId },
    first: args.first,
    offset: args.offset,
  })
}

/** 取得某型錄下的分類清單（BuyerID + CatalogID 都必填） */
export async function getBuyerCategories(
  creds: PatiscoCredentials,
  buyerId: string,
  catalogId: string,
) {
  return mcpCall<{ items: PatiscoBuyerCategory[] }>(creds, 'getBuyerCategories', {
    filter: { BuyerID: buyerId, CatalogID: catalogId },
  })
}

/** 取得某型錄/分類下的商品列表（BuyerID + CatalogID 都必填） */
export async function getBuyerCategoryProducts(
  creds: PatiscoCredentials,
  args: {
    buyerId: string
    catalogId: string
    categoryId?: string
    first?: number
    offset?: number
  },
) {
  return mcpCall<{ items: PatiscoBuyerCatalogProduct[]; totalCount?: number }>(
    creds,
    'getBuyerCategoryProducts',
    {
      filter: {
        BuyerID: args.buyerId,
        CatalogID: args.catalogId,
        ...(args.categoryId ? { CategoryID: args.categoryId } : {}),
      },
      first: args.first,
      offset: args.offset,
    },
  )
}

/** 取得商品完整資料（含 GW/NW/尺寸/圖片等，BuyerID + CatalogID + ProductID 都必填） */
export async function getBuyerProductDetail(
  creds: PatiscoCredentials,
  args: {
    buyerId: string
    catalogId: string
    productId: string   // 型錄商品 ID（非 PAXIS productId）
  },
) {
  return mcpCall<{ item?: PatiscoProductDetail }>(creds, 'getBuyerProductDetail', {
    filter: {
      BuyerID: args.buyerId,
      CatalogID: args.catalogId,
      ProductID: args.productId,
    },
  })
}

/** 搜尋買家（模糊搜尋名稱） */
export async function searchBuyers(
  creds: PatiscoCredentials,
  query: string,
  first = 20,
) {
  return mcpCall<{ items: PatiscoBuyer[] }>(creds, 'searchBuyers', {
    query,
    first,
  })
}

// ─── 出貨 / 費用型工具 ────────────────────────────────────────────────────────

export type PatiscoShippingUpdate = {
  TrackingNo?: string
  Carrier?: string         // e.g. 'UPS'
  ServiceCode?: string     // e.g. '03' = UPS Ground
  ShipDate?: string        // ISO date
  EstimatedDelivery?: string
}

/** 把 UPS tracking number 推回 Patisco PI */
export async function updateOrderShipping(
  creds: PatiscoCredentials,
  orderId: string,
  shipping: PatiscoShippingUpdate,
) {
  return mcpCall<{ ok: boolean }>(creds, 'updateOrderShipping', {
    OrderID: orderId,
    Shipping: shipping,
  })
}

export type PatiscoSurcharge = {
  Type: string             // 費用類型，e.g. 'FREIGHT'
  Amount: number
  CurrencyCode: string
  Note?: string
}

/** 在 Patisco PI 上加運費或附加費 */
export async function addOrderSurcharge(
  creds: PatiscoCredentials,
  orderId: string,
  surcharge: PatiscoSurcharge,
) {
  return mcpCall<{ SurchargeID: string }>(creds, 'addOrderSurcharge', {
    OrderID: orderId,
    ...surcharge,
  })
}

// ─── PI 完整建立流程（PAXIS → Patisco 反向推送） ──────────────────────────────

export type PatiscoOrderItem = {
  ProductID: string
  Quantity: number
  Price?: number
  CurrencyCode?: string
  Note?: string
}

/** 建立空白 PI 草稿（第一步） */
export async function createDraftOrder(
  creds: PatiscoCredentials,
  buyerId: string,
) {
  return mcpCall<{ OrderID: string }>(creds, 'createDraftOrder', {
    BuyerID: buyerId,
  })
}

/** 在 PI 草稿上加一筆商品明細 */
export async function addOrderItem(
  creds: PatiscoCredentials,
  orderId: string,
  item: PatiscoOrderItem,
) {
  return mcpCall<{ ItemID: string }>(creds, 'addOrderItem', {
    OrderID: orderId,
    ...item,
  })
}

/** 提交 PI 草稿（第三步，從 draft → submitted） */
export async function submitOrder(
  creds: PatiscoCredentials,
  orderId: string,
) {
  return mcpCall<{ ok: boolean }>(creds, 'submitOrder', {
    OrderID: orderId,
  })
}

// ─── 通知型函式（保留向後相容，實際透過 sync.ts 運作）────────────────────────

/**
 * 通知 Patisco 庫存更新（入庫後呼叫）
 * 目前 MCP 沒有這個工具，留空 graceful degrade
 */
export async function notifyInventoryUpdate(_payload: {
  productId: number
  patiscoProductId: string
  quantity: number
  estimatedArrival?: string
}): Promise<{ ok: false; error: string }> {
  // MCP Gateway 目前不支援 push 庫存給 Patisco
  // 未來 Patisco 提供此 tool 時在此實作
  return { ok: false, error: 'Not implemented: MCP does not support inventory push' }
}

// ─── 賣家（供應商）名錄 ────────────────────────────────────────────────────────

export type PatiscoSeller = {
  ID: string
  Name: string
  Address?: string | null
  City?: string | null
  CountryCode?: string | null
  PostalCode?: string | null
  PhoneNo?: string | null
  FAX?: string | null
  TaxID?: string | null
  EMail?: string | null
  ContactPerson?: string | null
  Note?: string | null
  CompanyNumber?: string | null
  Currency?: string | null
  Trading?: string | null
  CreatedDate?: string | null
}

type GetSellersArgs = {
  filter?: {
    ID?: string
    Name?: string
    CountryCode?: string
    InvitationStatus?: string
    ContactPerson?: string
    EMail?: string
  }
  orderBy?: string
  first: number   // 必填
  offset: number  // 必填
}

type GetSellersResult = {
  totalCount?: string | number
  items: PatiscoSeller[]
}

/** @deprecated getSellers 已在新版 MCP API 移除。公司資料改從 order detail 提取。 */
export async function getSellers(
  _creds: PatiscoCredentials,
  _args: GetSellersArgs,
): Promise<{ ok: false; error: string }> {
  console.warn('[patisco] getSellers 已移除，請改用 listProformaInvoiceCopies 並從 order detail 提取 seller 資料')
  return { ok: false, error: 'getSellers: tool removed in new MCP API' }
}

// ─── Order Copy 型別 ──────────────────────────────────────────────────────────

export type PatiscoOrderCopy = {
  // 大寫（listOrderCopies 實際回傳格式）
  ID?: string
  No?: string
  Status?: string
  Type?: string
  Seller?: string
  Buyer?: string
  CurrencyCode?: string
  TradingCode?: string
  Port?: string
  ItemsCount?: string
  Price?: string | null
  CreatedDate?: string
  ExpiredDate?: string | null
  LastModifiedDate?: string | null
  // 小寫（備用，部分 API 路徑可能回傳小寫）
  id?: string
  no?: string
  status?: string
  type?: string
  seller?: string
  buyer?: string
  priceText?: string
  payment?: string | number
  createdDate?: string
}

export type PatiscoOrderCopyDetail = {
  id: string
  no?: string
  status?: string
  payment?: string | number
  createdDate?: string
  seller?: {
    name?: string
    address?: string
    city?: string
    countryCode?: string
    postalCode?: string
    phoneNo?: string
    email?: string
    fax?: string
    taxId?: string
  }
  buyer?: {
    name?: string
    address?: string
  }
  extraCharges?: PatiscoExtraCharge[]
  total?: {
    amount?: string
    totalPriceOfProducts?: string
  }
}

export type PatiscoOrderCopyProduct = {
  id?: string
  sku?: string
  modelNo?: string
  specification?: string
  note?: string | null
  quantity?: string | number
  price?: string | number
  currencyCode?: string
  unit?: string
  netWeight?: string | null
  grossWeight?: string | null
  unitPerCarton?: string | null
  length?: string | null
  width?: string | null
  height?: string | null
}

/** @deprecated listOrderCopies 已移除。改用 listProformaInvoiceCopies 或 listPurchaseOrderCopies。 */
export async function listOrderCopies(
  _creds: PatiscoCredentials,
  _args: { status: string; first?: number; offset?: number; orderBy?: string },
): Promise<{ ok: false; error: string }> {
  console.warn('[patisco] listOrderCopies 已移除，請改用 listProformaInvoiceCopies / listPurchaseOrderCopies')
  return { ok: false, error: 'listOrderCopies: tool removed in new MCP API' }
}

/** 取得 PO 副本完整 header（含 seller 資料） */
export async function getOrderCopyDetail(
  creds: PatiscoCredentials,
  copyId: string,
) {
  return mcpCall<{ data?: PatiscoOrderCopyDetail | null; item?: PatiscoOrderCopyDetail }>(creds, 'getOrderCopyDetail', { copyId })
}

/** 取得副本的商品明細（新版參數：copyId + page） */
export async function getOrderCopyProducts(
  creds: PatiscoCredentials,
  copyId: string,
  page = 1,
) {
  return mcpCall<PatiscoListResult<PatiscoOrderCopyProduct> & { items: PatiscoOrderCopyProduct[]; totalCount?: string | number }>(
    creds,
    'getOrderCopyProducts',
    { copyId, page },
  )
}

/**
 * 通知 Patisco 採購單建立（更新預計到貨）
 * 目前 MCP 沒有這個工具，留空 graceful degrade
 */
export async function notifyPurchaseCreated(_payload: {
  patiscoOrderId?: string
  poNo: string
  estimatedArrival?: string
}): Promise<{ ok: false; error: string }> {
  return { ok: false, error: 'Not implemented: MCP does not support PO push' }
}
