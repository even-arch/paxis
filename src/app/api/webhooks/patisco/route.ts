import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { prisma } from '@/lib/db'
import { syncPatiscoPIs } from '@/api/patisco/sync'
import { decrypt } from '@/lib/crypto'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('x-patisco-signature') ?? ''

  const config = await prisma.sYS_PatiscoConfig.findFirst({ where: { isActive: true } }).catch(() => null)

  if (config?.webhookSecret) {
    const secret = decrypt(config.webhookSecret)
    const expected = createHmac('sha256', secret).update(body).digest('hex')
    if (sig !== `sha256=${expected}`) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  } else {
    const globalSecret = process.env.PATISCO_WEBHOOK_SECRET
    if (globalSecret) {
      const expected = createHmac('sha256', globalSecret).update(body).digest('hex')
      if (sig && sig !== `sha256=${expected}`) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }
  }

  try {
    const result = await syncPatiscoPIs('webhook', prisma)
    return NextResponse.json({ ok: true, source: 'webhook', ...result })
  } catch (err) {
    console.error('[webhook/patisco]', err)
    return NextResponse.json({ ok: false, error: 'Internal error' })
  }
}
