/**
 * POST /api/marketplace/channel
 * 儲存電商平台 API 憑證（加密後存入 MKT_Channel）
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { platform, label, apiKey, secretKey, saltKey } = body as {
    platform: string
    label?: string
    apiKey: string
    secretKey: string
    saltKey: string
  }

  if (!platform || !apiKey || !secretKey || !saltKey) {
    return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
  }

  // 加密儲存（AES-256-GCM，key 來自 ENCRYPTION_SECRET 環境變數）
  const channel = await prisma.mKT_Channel.upsert({
    where: {
      // 一個平台只允許一個 channel（後續如需多店可改）
      // 先用 platform 做唯一識別，若 DB 沒有 unique constraint 就用 findFirst + update
      id: (await prisma.mKT_Channel.findFirst({ where: { platform } }))?.id ?? 0,
    },
    create: {
      platform,
      label: label ?? platform,
      apiKey:    encrypt(apiKey),
      secretKey: encrypt(secretKey),
      saltKey:   encrypt(saltKey),
      isActive: true,
    },
    update: {
      label: label ?? platform,
      apiKey:    encrypt(apiKey),
      secretKey: encrypt(secretKey),
      saltKey:   encrypt(saltKey),
      isActive: true,
    },
  })

  return NextResponse.json({ ok: true, channelId: channel.id })
}

/**
 * GET /api/marketplace/channel
 * 回傳目前設定（遮罩金鑰，只顯示前 6 碼）
 */
export async function GET() {
  const channels = await prisma.mKT_Channel.findMany({
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(
    channels.map((c: typeof channels[number]) => ({
      id:        c.id,
      platform:  c.platform,
      label:     c.label,
      isActive:  c.isActive,
      lastSyncAt: c.lastSyncAt,
      // 解密後只顯示前 6 碼 + 遮罩
      apiKeyMasked: maskKey(tryDecrypt(c.apiKey)),
    }))
  )
}

function tryDecrypt(val: string): string {
  try { return decrypt(val) } catch { return '' }
}

function maskKey(key: string): string {
  if (!key || key.length < 6) return '***'
  return key.slice(0, 6) + '•'.repeat(Math.min(key.length - 6, 10))
}
