import { NextRequest, NextResponse } from 'next/server'
import { handleOrderConfirmed, type PatiscoOrderConfirmedPayload } from '@/api/patisco/webhook'
import { createHmac } from 'crypto'

export async function POST(req: NextRequest) {
  // 驗證 webhook 簽名
  const secret = process.env.PATISCO_WEBHOOK_SECRET
  if (secret) {
    const sig = req.headers.get('x-patisco-signature') ?? ''
    const body = await req.text()
    const expected = createHmac('sha256', secret).update(body).digest('hex')
    if (sig !== `sha256=${expected}`) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    const payload = JSON.parse(body) as PatiscoOrderConfirmedPayload
    return handleEvent(payload)
  }

  const payload = await req.json() as PatiscoOrderConfirmedPayload
  return handleEvent(payload)
}

async function handleEvent(payload: PatiscoOrderConfirmedPayload) {
  try {
    if (payload.event === 'order.confirmed') {
      const result = await handleOrderConfirmed(payload)
      const needReorder = result.filter(r => r.belowSafety)
      return NextResponse.json({ ok: true, processed: result.length, needReorder })
    }
    return NextResponse.json({ ok: true, message: 'Event ignored' })
  } catch (err) {
    console.error('[webhook/patisco]', err)
    // 永遠回 200 避免 Patisco 重試
    return NextResponse.json({ ok: false, error: 'Internal error' })
  }
}
