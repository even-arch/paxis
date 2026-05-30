import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'

// POS webhook HMAC 簽名驗證（與 Patisco webhook 同機制）
// Secret 存於環境變數 POS_WEBHOOK_SECRET
export function verifyPosSignature(req: NextRequest, body: string): boolean {
  const secret = process.env.POS_WEBHOOK_SECRET
  if (!secret) return true // 未設定則不驗證（開發環境）

  const sig = req.headers.get('x-pos-signature') ?? ''
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  return sig === `sha256=${expected}`
}

// POS 公開 API 認證（API Key 模式）
export function verifyPosApiKey(req: NextRequest): boolean {
  const key = process.env.POS_API_KEY
  if (!key) return true // 未設定則不驗證（開發環境）

  const provided = req.headers.get('x-api-key') ?? ''
  return provided === key
}
