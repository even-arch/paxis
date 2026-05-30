import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.sYS_User.findUnique({
    where: { id: Number(session.user.id) },
    select: { aiProvider: true, encryptedAiKey: true },
  })

  return NextResponse.json({
    aiProvider: user?.aiProvider ?? '',
    apiKeySet: !!user?.encryptedAiKey,
    // 只回傳末 4 碼供確認，不回傳明文
    apiKeyHint: user?.encryptedAiKey
      ? '••••' + decrypt(user.encryptedAiKey).slice(-4)
      : '',
  })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { aiProvider, apiKey } = await req.json()

  if (!aiProvider || !['claude', 'openai'].includes(aiProvider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }

  const data: Record<string, string | null> = { aiProvider }
  if (apiKey && apiKey.trim()) {
    data.encryptedAiKey = encrypt(apiKey.trim())
  }

  await prisma.sYS_User.update({
    where: { id: Number(session.user.id) },
    data,
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.sYS_User.update({
    where: { id: Number(session.user.id) },
    data: { aiProvider: null, encryptedAiKey: null },
  })

  return NextResponse.json({ ok: true })
}
