import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto'

export async function GET() {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await prisma.sYS_EmailConfig.findFirst({ where: { isActive: true } })
  if (!config) return NextResponse.json({ configured: false })

  return NextResponse.json({
    configured: true,
    provider: config.provider,
    apiKeySet: !!config.encryptedApiKey,
    apiKeyHint: config.encryptedApiKey
      ? '••••' + decrypt(config.encryptedApiKey).slice(-4)
      : '',
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    lastTestedAt: config.lastTestedAt?.toISOString() ?? null,
    lastTestStatus: config.lastTestStatus,
    lastTestMsg: config.lastTestMsg,
  })
}

export async function PUT(req: NextRequest) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { apiKey, fromEmail, fromName } = await req.json() as {
    apiKey?: string; fromEmail?: string; fromName?: string
  }

  if (!fromEmail || !fromEmail.includes('@')) {
    return NextResponse.json({ error: '請填入有效的發件 Email' }, { status: 400 })
  }

  const existing = await prisma.sYS_EmailConfig.findFirst({ where: { isActive: true } })
  const data: Record<string, unknown> = {
    provider: 'resend',
    fromEmail: fromEmail.trim(),
    fromName: fromName?.trim() ?? '',
    isActive: true,
  }
  if (apiKey?.trim()) data.encryptedApiKey = encrypt(apiKey.trim())

  if (existing) {
    await prisma.sYS_EmailConfig.update({ where: { id: existing.id }, data })
  } else {
    await prisma.sYS_EmailConfig.create({ data })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.sYS_EmailConfig.updateMany({
    where: { isActive: true },
    data: { isActive: false, encryptedApiKey: null },
  })
  return NextResponse.json({ ok: true })
}
