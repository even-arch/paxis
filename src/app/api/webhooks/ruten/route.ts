/**
 * 露天拍賣 Webhook 接收端點
 * POST /api/webhooks/ruten
 *
 * 露天會 POST 以下事件到此 URL：
 *   create_order   — 新訂單成立
 *   order_paid     — 買家付款完成
 *   buyer_cancel   — 買家申請取消
 *   order_cancel   — 訂單已取消
 *
 * 規格參考：RUTEN-OPEN-API-notify.pdf
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyRutenSignature } from '@/lib/ruten/auth'

const WEBHOOK_PATH = '/api/webhooks/ruten'

export async function POST(req: NextRequest) {
  // 1. 讀取 raw body（簽章驗證需要原始字串）
  const rawBody = await req.text()

  const apiKey    = req.headers.get('x-rt-key') ?? ''
  const timestamp = req.headers.get('x-rt-timestamp') ?? ''
  const signature = req.headers.get('x-rt-authorization') ?? ''

  // 2. 查找對應的 MKT_Channel（用 apiKey 比對）
  const channel = await prisma.mKT_Channel.findFirst({
    where: { apiKey, platform: 'RUTEN', isActive: true },
  })

  if (!channel) {
    console.warn('[Ruten Webhook] Unknown API Key:', apiKey)
    return NextResponse.json({ error: 'Unknown channel' }, { status: 401 })
  }

  // 3. 驗證簽章
  const valid = verifyRutenSignature(
    { apiKey, secretKey: channel.secretKey, saltKey: channel.saltKey },
    WEBHOOK_PATH,
    rawBody,
    timestamp,
    signature,
  )

  if (!valid) {
    console.warn('[Ruten Webhook] Invalid signature for channel', channel.id)
    await logSync(channel.id, 'webhook_received', 'error', undefined, '簽章驗證失敗')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // 4. 解析 payload
  let payload: RutenWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action_type, order_no } = payload

  // 5. 寫入 sync log
  await logSync(channel.id, 'webhook_received', 'ok', order_no, `action: ${action_type}`)

  // 6. 依事件類型處理
  try {
    switch (action_type) {
      case 'create_order':
        await handleCreateOrder(channel.id, order_no, payload)
        break

      case 'order_paid':
        await handleOrderPaid(channel.id, order_no)
        break

      case 'buyer_cancel':
        await handleOrderCancel(channel.id, order_no, 'buyer_cancel')
        break

      case 'order_cancel':
        await handleOrderCancel(channel.id, order_no, 'order_cancel')
        break

      default:
        console.log('[Ruten Webhook] Unknown action_type:', action_type)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Ruten Webhook] Handler error:', msg)
    await logSync(channel.id, 'webhook_received', 'error', order_no, msg)
    // 仍回 200，避免露天重複推送
  }

  // 露天規格要求：成功回 HTTP 201
  return NextResponse.json({ ok: true }, { status: 201 })
}

// ─── 事件處理 ────────────────────────────────────────────────────────────────

async function handleCreateOrder(
  channelId: number,
  orderNo: string,
  payload: RutenWebhookPayload,
) {
  // upsert：避免重複 webhook 造成重複建立
  await prisma.mKT_Order.upsert({
    where: { channelId_platformOrderNo: { channelId, platformOrderNo: orderNo } },
    create: {
      channelId,
      platformOrderNo: orderNo,
      status: 'pending',
      rawPayload:  payload as object,
    },
    update: {
      // 已存在則不覆蓋，只補 rawPayload
      rawPayload: payload as object,
    },
  })
}

async function handleOrderPaid(channelId: number, orderNo: string) {
  await prisma.mKT_Order.updateMany({
    where: { channelId, platformOrderNo: orderNo },
    data: {
      status: 'paid',
      paidAt: new Date(),
    },
  })
}

async function handleOrderCancel(
  channelId: number,
  orderNo: string,
  reason: string,
) {
  await prisma.mKT_Order.updateMany({
    where: {
      channelId,
      platformOrderNo: orderNo,
      status: { notIn: ['shipped', 'cancelled'] },
    },
    data: {
      status: 'cancelled',
      rawPayload: { cancelReason: reason, cancelledAt: new Date().toISOString() },
    },
  })
}

// ─── 工具函式 ─────────────────────────────────────────────────────────────────

async function logSync(
  channelId: number,
  action: string,
  status: string,
  platformOrderNo?: string,
  detail?: string,
) {
  await prisma.mKT_SyncLog.create({
    data: { channelId, action, status, platformOrderNo, detail },
  })
}

// ─── 類型定義 ─────────────────────────────────────────────────────────────────

interface RutenWebhookPayload {
  action_type: string
  order_no:    string
  [key: string]: unknown
}
