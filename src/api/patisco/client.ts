/**
 * Patisco API 客戶端
 * 所有對 Patisco 的呼叫都集中在這裡
 * 呼叫失敗必須 graceful degrade，不能讓主流程出錯
 */

const BASE_URL = process.env.PATISCO_API_URL ?? ''
const API_KEY = process.env.PATISCO_API_KEY ?? ''

async function patiscoFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  if (!BASE_URL || !API_KEY) {
    return { ok: false, error: 'Patisco not configured' }
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
        ...options.headers,
      },
    })

    if (!res.ok) {
      return { ok: false, error: `Patisco API error: ${res.status}` }
    }

    const data = await res.json() as T
    return { ok: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[patisco]', path, msg)
    return { ok: false, error: msg }
  }
}

// ─── 訂單相關 ───────────────────────────────────────────────

export type PatiscoOrder = {
  id: number
  no: string
  status: number
  items: Array<{
    productId: number
    sku: string
    quantity: number
  }>
}

/** 取得 Patisco 訂單（用於採購建議） */
export async function getPatiscoOrder(orderId: number) {
  return patiscoFetch<PatiscoOrder>(`/api/orders/${orderId}`)
}

// ─── 庫存相關 ───────────────────────────────────────────────

/** 通知 Patisco 庫存有變動（入庫後呼叫） */
export async function notifyInventoryUpdate(payload: {
  productId: number      // PAXIS PRD_Product.id
  patiscoProductId: number // Patisco PRD_Product.ID
  quantity: number
  estimatedArrival?: string // ISO date
}) {
  return patiscoFetch('/api/inventory/notify', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ─── 採購單相關 ─────────────────────────────────────────────

/** 通知 Patisco 採購單建立（更新預計到貨） */
export async function notifyPurchaseCreated(payload: {
  patiscoOrderId?: number
  poNo: string
  estimatedArrival?: string
}) {
  if (!payload.patiscoOrderId) return { ok: false as const, error: 'No patiscoOrderId' }
  return patiscoFetch('/api/purchase/notify', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
