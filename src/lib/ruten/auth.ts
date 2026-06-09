/**
 * 露天拍賣 Open API — 簽章工具
 *
 * 簽章規則（RUTEN-OPEN-API 規格書）：
 *   HMAC-SHA256(Secret Key, Salt Key + URL Path + Request Body + Timestamp)
 *
 * Request Headers:
 *   X-RT-Key:           API Key
 *   X-RT-Timestamp:     Unix 秒數（整數字串）
 *   X-RT-Authorization: base64(HMAC-SHA256 signature)
 */

import crypto from 'crypto'

export const RUTEN_BASE_URL = 'https://partner.ruten.com.tw'

export interface RutenCredentials {
  apiKey: string
  secretKey: string
  saltKey: string
}

/**
 * 產生露天 API 簽章 Headers
 */
export function buildRutenHeaders(
  creds: RutenCredentials,
  urlPath: string,      // e.g. "/api/v1/order/list"
  body: string,         // JSON string or "" for GET
  timestamp?: number,   // Unix 秒，不填則用 Date.now()
): Record<string, string> {
  const ts = timestamp ?? Math.floor(Date.now() / 1000)

  // HMAC-SHA256(Secret Key, Salt Key + URL Path + Request Body + Timestamp)
  const message = creds.saltKey + urlPath + body + String(ts)
  const signature = crypto
    .createHmac('sha256', creds.secretKey)
    .update(message)
    .digest('base64')

  return {
    'X-RT-Key':           creds.apiKey,
    'X-RT-Timestamp':     String(ts),
    'X-RT-Authorization': signature,
    'Content-Type':       'application/json',
  }
}

/**
 * 驗證露天 Webhook 通知的簽章（露天推送給我們時）
 */
export function verifyRutenSignature(
  creds: RutenCredentials,
  urlPath: string,
  body: string,
  timestamp: string,
  receivedSignature: string,
): boolean {
  const message = creds.saltKey + urlPath + body + timestamp
  const expected = crypto
    .createHmac('sha256', creds.secretKey)
    .update(message)
    .digest('base64')

  // 使用 timingSafeEqual 防止 timing attack
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(receivedSignature)
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * 呼叫露天 API（POST）
 */
export async function rutenPost<T = unknown>(
  creds: RutenCredentials,
  path: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const body = JSON.stringify(payload)
  const headers = buildRutenHeaders(creds, path, body)

  const res = await fetch(RUTEN_BASE_URL + path, {
    method: 'POST',
    headers,
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ruten API ${path} failed [${res.status}]: ${text}`)
  }

  return res.json() as Promise<T>
}

/**
 * 呼叫露天 API（GET，帶 query params）
 */
export async function rutenGet<T = unknown>(
  creds: RutenCredentials,
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString()
  const fullPath = qs ? `${path}?${qs}` : path
  const headers = buildRutenHeaders(creds, path, '') // GET body 為空字串

  const res = await fetch(RUTEN_BASE_URL + fullPath, {
    method: 'GET',
    headers,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ruten API ${path} failed [${res.status}]: ${text}`)
  }

  return res.json() as Promise<T>
}
