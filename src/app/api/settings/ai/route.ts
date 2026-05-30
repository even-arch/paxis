import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const user = await prisma.sYS_User.findUnique({
      where: { id: Number(session.user.id) },
      select: { aiProvider: true, encryptedAiKey: true, aiParseModel: true },
    })

    return NextResponse.json({
      aiProvider: user?.aiProvider ?? '',
      apiKeySet: !!user?.encryptedAiKey,
      apiKeyHint: user?.encryptedAiKey
        ? '••••' + decrypt(user.encryptedAiKey).slice(-4)
        : '',
      aiParseModel: user?.aiParseModel ?? '',
    })
  } catch (err) {
    console.error('[GET /api/settings/ai]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json() as {
      aiProvider?: string; apiKey?: string; aiParseModel?: string | null
    }

    const { aiProvider, apiKey, aiParseModel } = body

    if (!aiProvider || !['anthropic', 'openai'].includes(aiProvider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }

    await prisma.sYS_User.update({
      where: { id: Number(session.user.id) },
      data: {
        aiProvider,
        aiParseModel: aiParseModel || null,
        ...(apiKey?.trim() ? { encryptedAiKey: encrypt(apiKey.trim()) } : {}),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PUT /api/settings/ai]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await prisma.sYS_User.update({
      where: { id: Number(session.user.id) },
      data: { aiProvider: null, encryptedAiKey: null, aiParseModel: null },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/settings/ai]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
