import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { syncPatiscoPIs } from '@/api/patisco/sync'
import { prisma } from '@/lib/db'
import { patiscoLogin, getOrderProducts, type PatiscoPIProduct } from '@/api/patisco/client'

/**
 * Patisco Webhook（備用路線）
 *
 * 目前 Patisco MCP Gateway 是 pull-only，沒有 webhook push。
 * 這個 route 保留用於：
 *   a) Patisco 未來支援 webhook 推送時，自動啟用
 *   b) 手動觸發（測試或緊急補跑）
 *
 * 兩種呼叫模式：
 *   1. 無 body：觸發完整輪詢（等同 cron，但手動觸發）
 *   2. 有 body（event: 'order.confirmed'）：只處理該筆 PI
 */
export async function POST(req: NextRequest) {
  // 驗證簽名（有設定 secret 才驗）
  const secret = process.env.PATISCO_WEBHOOK_SECRET
  if (secret) {
    const sig = req.headers.get('x-patisco-signature') ?? ''
    const body = await req.text()
    const expected = createHmac('sha256', secret).update(body).digest('hex')
    if (sig !== `sha256=${expected}`) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // 有 body 且驗過簽名 → 處理單筆 PI 推送
    try {
      const payload = JSON.parse(body)
      if (payload.event === 'order.confirmed' && payload.orderId) {
        const singleResult = await processSinglePI(payload.orderId, payload.orderNo ?? String(payload.orderId))
        return NextResponse.json({ ok: true, source: 'webhook', ...singleResult })
      }
    } catch {
      // body parse 失敗 → fallthrough 到全量 sync
    }
  }

  // 無 body 或無 secret → 觸發完整輪詢（manual trigger）
  try {
    const result = await syncPatiscoPIs('webhook')
    return NextResponse.json({ ok: true, source: 'webhook-manual', ...result })
  } catch (err) {
    console.error('[webhook/patisco]', err)
    // 永遠回 200 避免 Patisco 重試導致重複處理
    return NextResponse.json({ ok: false, error: 'Internal error' })
  }
}

// ─── 處理單筆 PI（Patisco 直接推送模式用）────────────────────────────────────

async function processSinglePI(patiscoDocId: number, patiscoDocNo: string) {
  // 去重
  const existing = await prisma.sYS_PatiscoSync.findUnique({
    where: { patiscoDocId },
  })
  if (existing) return { skipped: true, patiscoDocNo }

  const creds = await patiscoLogin()
  if (!creds) return { error: 'Auth failed' }

  const prodRes = await getOrderProducts(creds, patiscoDocId)
  if (!prodRes.ok) {
    await prisma.sYS_PatiscoSync.create({
      data: { patiscoDocId, patiscoDocNo, source: 'webhook', status: 'error', errorMsg: prodRes.error },
    })
    return { error: prodRes.error }
  }

  const products: PatiscoPIProduct[] = prodRes.data?.items ?? []
  const itemResults: Array<{ sku: string; qty: number; stockAfter: number }> = []

  for (const item of products) {
    const product = await prisma.pRD_Product.findFirst({
      where: {
        isActive: true,
        OR: [
          { patiscoProductId: Number(item.ProductID) },
          ...(item.SKU ? [{ sku: item.SKU }] : []),
        ],
      },
    })
    if (!product) continue

    const qty = item.Quantity
    const stock = await prisma.iNV_Stock.upsert({
      where: { productId: product.id },
      create: { productId: product.id, quantity: 0, reservedQty: 0, safetyStock: 0 },
      update: { quantity: { decrement: qty } },
    })
    const stockAfter = Math.max(0, stock.quantity)
    if (stock.quantity < 0) {
      await prisma.iNV_Stock.update({ where: { productId: product.id }, data: { quantity: 0 } })
    }

    await prisma.iNV_Movement.create({
      data: {
        productId: product.id,
        type: 4,
        qtyDelta: -qty,
        reservedDelta: 0,
        quantityAfter: stockAfter,
        reservedAfter: stock.reservedQty,
        patiscoDocType: 'PI_CONFIRMED',
        patiscoDocId,
        patiscoDocNo,
        note: `Patisco PI 確認出倉：${patiscoDocNo}`,
      },
    })

    itemResults.push({ sku: item.SKU ?? String(item.ProductID), qty, stockAfter })
  }

  await prisma.sYS_PatiscoSync.create({
    data: { patiscoDocId, patiscoDocNo, source: 'webhook', status: 'ok', result: itemResults as object },
  })

  return { ok: true, patiscoDocNo, items: itemResults }
}
