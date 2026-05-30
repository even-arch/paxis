/**
 * Patisco MCP Gateway Client
 * 協定：JSON-RPC 2.0 over HTTP POST
 * 端點：https://mcp.patisco.com:9443
 *
 * 注意：MCP Gateway 是 pull-only，沒有 webhook push。
 * PAXIS 透過兩條路同步：
 *   1. Cron 輪詢（主要）：每 5 分鐘拉一次 getPIs
 *   2. Webhook（備用）：Patisco 未來支援時自動啟用
 */

// 預設值（DB 設定優先，環境變數備援）
const DEFAULT_MCP_URL = process.env.PATISCO_MCP_URL ?? 'https://mcp.patisco.com:9443'

// ─── 型別定義 ─────────────────────────────────────────────────────────────────

export type PatiscoCredentials = {
  jwt: string
  apiKey: string
  userId: string
  tenantId: string
}

export type PatiscoPI = {
  ID: string | number
  No: string
  Status: string | number  // 3 = 已確認
  Type: string | number    // 2 = PI
  BuyerID: string | number
  BuyerName?: string
  CreatedDate: string
  Products?: PatiscoPIProduct[]
}

export type PatiscoPIProduct = {
  ID: string | number
  ProductID: string | number
  Name: string
  SKU?: string
  Quantity: number
  Price?: number
  CurrencyCode?: string
}

// ─── 認證 ─────────────────────────────────────────────────────────────────────

/**
 * 取得 Patisco 認證憑證
 * 優先順序：
 *   1. DB Token 模式（直接貼 JWT + API Key）→ JWT 未過期才用
 *   2. DB 帳密模式（自動登入）
 *   3. 環境變數備援
 */
export async function patiscoLogin(): Promise<(PatiscoCredentials & { _mcpUrl: string }) | null> {
  try {
    const { prisma } = await import('@/lib/db')
    const { decrypt } = await import('@/lib/crypto')

    const config = await prisma.sYS_PatiscoConfig.findFirst({
      where: { isActive: true },
      orderBy: { id: 'desc' },
    })

    if (config) {
      const mcpUrl = config.mcpUrl

      // ── 模式 1：Token 模式（JWT + API Key 直接使用）──────────────────────
      if (config.encryptedJwt && config.apiKey) {
        // 檢查 JWT 是否過期
        const isExpired = config.jwtExpiresAt && config.jwtExpiresAt < new Date()
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
          await prisma.sYS_PatiscoConfig.update({
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
    const res = await fetch(`${mcpUrl}/auth/login`, {
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
  const base = creds._mcpUrl ?? DEFAULT_MCP_URL
  try {
    const res = await fetch(`${base}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${creds.jwt}`,
        'X-API-Key': creds.apiKey,
        'Accept': 'application/json',
      },
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

    const json = await res.json()

    if (json.error) {
      return { ok: false, error: json.error.message ?? JSON.stringify(json.error) }
    }

    // MCP 回傳格式：result.structuredContent 或 result.content[0].text
    const data = json.result?.structuredContent ?? json.result
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

/** 查詢 Patisco PI 列表（已確認的才需要同步） */
export async function getPIs(
  creds: PatiscoCredentials,
  args: GetPIsArgs = {},
) {
  return mcpCall<GetPIsResult>(creds, 'patisco_getPIs', args as Record<string, unknown>)
}

/** 查詢 PI 的商品明細 */
export async function getOrderProducts(
  creds: PatiscoCredentials,
  piId: string | number,
) {
  return mcpCall<{ items: PatiscoPIProduct[] }>(creds, 'patisco_getOrderProducts', {
    filter: { OrderID: String(piId) },
  })
}

/** 查詢出貨單明細 */
export async function getShipmentDetail(
  creds: PatiscoCredentials,
  deliveryOrderId: string | number,
) {
  return mcpCall<Record<string, unknown>>(creds, 'patisco_getShipmentDetail', {
    filter: { DeliveryOrderID: String(deliveryOrderId) },
  })
}

/** 在 Patisco 建立空白 PI 草稿（PAXIS 反向推送用） */
export async function addBlankPIOrder(
  creds: PatiscoCredentials,
  buyerId: string | number,
  products: Array<{ ProductID: string | number; Quantity: number }> = [],
) {
  return mcpCall<{ OrderID: string }>(creds, 'patisco_addBlankPIOrder', {
    BuyerID: String(buyerId),
    Products: products,
  })
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

// ─── 通知型函式（保留向後相容，實際透過 sync.ts 運作）────────────────────────

/**
 * 通知 Patisco 庫存更新（入庫後呼叫）
 * 目前 MCP 沒有這個工具，留空 graceful degrade
 */
export async function notifyInventoryUpdate(_payload: {
  productId: number
  patiscoProductId: number
  quantity: number
  estimatedArrival?: string
}): Promise<{ ok: false; error: string }> {
  // MCP Gateway 目前不支援 push 庫存給 Patisco
  // 未來 Patisco 提供此 tool 時在此實作
  return { ok: false, error: 'Not implemented: MCP does not support inventory push' }
}

/**
 * 通知 Patisco 採購單建立（更新預計到貨）
 * 目前 MCP 沒有這個工具，留空 graceful degrade
 */
export async function notifyPurchaseCreated(_payload: {
  patiscoOrderId?: number
  poNo: string
  estimatedArrival?: string
}): Promise<{ ok: false; error: string }> {
  return { ok: false, error: 'Not implemented: MCP does not support PO push' }
}
