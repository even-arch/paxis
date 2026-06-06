/**
 * UPS OAuth 2.0 — client_credentials grant
 *
 * PAXIS 是單一系統帳號，不需要每個用戶各自授權（那是 Patisco 的做法）。
 * 這裡直接用 client_id + client_secret 換 access_token。
 *
 * token 有效期 4 小時。在 Vercel serverless 環境，module-level cache 可在
 * 同一 instance 重用，過期或 instance 冷啟動時自動重新換取。
 */

const UPS_TOKEN_URL = 'https://onlinetools.ups.com/security/v1/oauth/token'

interface TokenCache {
  accessToken: string
  expiresAt: number  // Date.now() ms
}

// module-level cache（同一 serverless instance 共用）
let _cache: TokenCache | null = null

export async function getUpsAccessToken(): Promise<string> {
  // 還有 5 分鐘才到期才算有效
  if (_cache && _cache.expiresAt - Date.now() > 5 * 60 * 1000) {
    return _cache.accessToken
  }

  const clientId     = process.env.UPS_CLIENT_ID
  const clientSecret = process.env.UPS_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('UPS API 憑證未設定（UPS_CLIENT_ID / UPS_CLIENT_SECRET）')
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(UPS_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`UPS token 取得失敗 (${res.status}): ${err}`)
  }

  const data = await res.json() as {
    access_token: string
    expires_in: string  // 秒數，字串
  }

  _cache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + parseInt(data.expires_in, 10) * 1000,
  }

  return _cache.accessToken
}
