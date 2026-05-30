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

const MCP_BASE = process.env.PATISCO_MCP_URL ?? 'https://mcp.patisco.com:9443'
const LOGIN_ID = process.env.PATISCO_USERNAME ?? ''
const PASSWORD = process.env.PATISCO_PASSWORD ?? ''

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
 * 登入取得 JWT + API Key
 * Vercel serverless 每次 invocation 都重新認證（無法持久化 in-memory token）
 */
export async function patiscoLogin(): Promise<PatiscoCredentials | null> {
  if (!LOGIN_ID || !PASSWORD) {
    console.warn('[patisco] PATISCO_USERNAME / PATISCO_PASSWORD 未設定，跳過')
    return null
  }

  try {
    const res = await fetch(`${MCP_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId: LOGIN_ID, password: PASSWORD }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      console.error('[patisco] 登入失敗', res.status)
      return null
    }

    return await res.json() as PatiscoCredentials
  } catch (err) {
    console.error('[patisco] 登入錯誤', err)
    return null
  }
}

// ─── JSON-RPC 基礎呼叫 ────────────────────────────────────────────────────────

let _reqId = 1

async function mcpCall<T>(
  creds: PatiscoCredentials,
  tool: string,
  args: Record<string, unknown> = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${MCP_BASE}/`, {
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
export async function listTools(creds: PatiscoCredentials) {
  try {
    const res = await fetch(`${MCP_BASE}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${creds.jwt}`,
        'X-API-Key': creds.apiKey,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: _reqId++, method: 'tools/list', params: {} }),
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
