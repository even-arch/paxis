import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/crypto'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await prisma.sYS_PatiscoConfig.findFirst({
    where: { isActive: true },
    orderBy: { id: 'desc' },
  })

  if (!config) return NextResponse.json({ configured: false })

  return NextResponse.json({
    configured: true,
    mcpUrl: config.mcpUrl,
    // 帳密模式
    username: config.username ?? '',
    passwordSet: !!config.encryptedPass,
    // Token 模式
    apiKey: config.apiKey ?? '',
    userId: config.userId ?? '',
    jwtSet: !!config.encryptedJwt,
    jwtExpiresAt: config.jwtExpiresAt?.toISOString() ?? null,
    jwtExpired: config.jwtExpiresAt ? config.jwtExpiresAt < new Date() : false,
    // 安全
    webhookSecretSet: !!config.webhookSecret,
    cronSecretSet: !!config.cronSecret,
    // 狀態
    lastTestedAt: config.lastTestedAt?.toISOString() ?? null,
    lastTestStatus: config.lastTestStatus ?? null,
    lastTestMsg: config.lastTestMsg ?? null,
    updatedAt: config.updatedAt.toISOString(),
  })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const existing = await prisma.sYS_PatiscoConfig.findFirst({ where: { isActive: true } })

  const data: Record<string, unknown> = {
    mcpUrl: body.mcpUrl || 'https://mcp.patisco.com:9443',
    isActive: true,
  }

  // ── 帳密模式 ──────────────────────────────────────────────────────────────
  if (body.username !== undefined) data.username = body.username || null
  if (body.password) data.encryptedPass = encrypt(body.password)

  // ── Token 模式 ────────────────────────────────────────────────────────────
  if (body.jwt) {
    data.encryptedJwt = encrypt(body.jwt)
    // 嘗試解析 JWT 到期時間
    try {
      const payload = JSON.parse(Buffer.from(body.jwt.split('.')[1], 'base64').toString())
      if (payload.exp) data.jwtExpiresAt = new Date(payload.exp * 1000)
    } catch { /* ignore */ }
  }
  if (body.apiKey !== undefined) data.apiKey = body.apiKey || null
  if (body.userId !== undefined) data.userId = body.userId || null

  // ── 安全設定 ──────────────────────────────────────────────────────────────
  if (body.webhookSecret !== undefined) data.webhookSecret = body.webhookSecret || null
  if (body.cronSecret !== undefined) data.cronSecret = body.cronSecret || null

  // 必須至少有一種登入方式
  const hasPassword = body.password || existing?.encryptedPass
  const hasToken = body.jwt || existing?.encryptedJwt
  const hasUsername = body.username || existing?.username
  if (!hasPassword && !hasToken) {
    return NextResponse.json({ error: '請填入密碼或直接貼上 JWT Token' }, { status: 400 })
  }
  if (hasPassword && !hasUsername && !body.username) {
    return NextResponse.json({ error: '使用帳密模式時，帳號為必填' }, { status: 400 })
  }

  if (existing) {
    await prisma.sYS_PatiscoConfig.update({ where: { id: existing.id }, data })
  } else {
    await prisma.sYS_PatiscoConfig.create({ data: data as Parameters<typeof prisma.sYS_PatiscoConfig.create>[0]['data'] })
  }

  return NextResponse.json({ ok: true })
}
