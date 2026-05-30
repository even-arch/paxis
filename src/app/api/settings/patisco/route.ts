import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto'

/** 取得目前設定（密碼不回傳，只回傳是否已設定） */
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
    username: config.username,
    passwordSet: !!config.encryptedPass,
    webhookSecretSet: !!config.webhookSecret,
    cronSecretSet: !!config.cronSecret,
    lastTestedAt: config.lastTestedAt,
    lastTestStatus: config.lastTestStatus,
    lastTestMsg: config.lastTestMsg,
    updatedAt: config.updatedAt,
  })
}

/** 儲存設定 */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { mcpUrl, username, password, webhookSecret, cronSecret } = body

  if (!username) return NextResponse.json({ error: '帳號為必填' }, { status: 400 })

  // 找現有設定
  const existing = await prisma.sYS_PatiscoConfig.findFirst({ where: { isActive: true } })

  // 密碼：有傳新的就加密，沒傳就保留舊的
  let encryptedPass = existing?.encryptedPass ?? ''
  if (password) {
    encryptedPass = encrypt(password)
  }

  if (!encryptedPass) {
    return NextResponse.json({ error: '首次設定必須填入密碼' }, { status: 400 })
  }

  const data = {
    mcpUrl: mcpUrl || 'https://mcp.patisco.com:9443',
    username,
    encryptedPass,
    webhookSecret: webhookSecret || null,
    cronSecret: cronSecret || null,
    isActive: true,
  }

  if (existing) {
    await prisma.sYS_PatiscoConfig.update({ where: { id: existing.id }, data })
  } else {
    await prisma.sYS_PatiscoConfig.create({ data })
  }

  return NextResponse.json({ ok: true })
}
