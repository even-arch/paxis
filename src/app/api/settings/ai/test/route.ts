import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.sYS_User.findUnique({
    where: { id: Number(session.user.id) },
    select: { aiProvider: true, encryptedAiKey: true },
  })

  if (!user?.aiProvider || !user?.encryptedAiKey) {
    return NextResponse.json({ error: '尚未設定 API Key' }, { status: 400 })
  }

  const apiKey = decrypt(user.encryptedAiKey)

  try {
    if (user.aiProvider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Reply with: ok' }],
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: { message?: string } }
        throw new Error(err.error?.message ?? `HTTP ${res.status}`)
      }
    } else {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Reply with: ok' }],
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: { message?: string } }
        throw new Error(err.error?.message ?? `HTTP ${res.status}`)
      }
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    )
  }
}
