import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminToken, ADMIN_COOKIE } from '@/lib/admin-auth'
import { getAdminSetting, setAdminSetting } from '@/lib/admin-settings'

async function assertAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE)?.value
  return token ? verifyAdminToken(token) : false
}

export async function GET() {
  if (!(await assertAdmin())) return NextResponse.json({ error: '未授權' }, { status: 401 })

  const [apiKey, from] = await Promise.all([
    getAdminSetting('resend_api_key'),
    getAdminSetting('resend_from'),
  ])

  return NextResponse.json({
    hasApiKey: !!apiKey,
    apiKeyHint: apiKey ? `${apiKey.slice(0, 8)}…` : null,
    from: from ?? '',
    hasEnvKey: !!process.env.SYSTEM_RESEND_API_KEY,
  })
}

export async function POST(req: NextRequest) {
  if (!(await assertAdmin())) return NextResponse.json({ error: '未授權' }, { status: 401 })

  const { apiKey, from } = await req.json() as { apiKey?: string; from?: string }

  if (apiKey !== undefined) {
    await setAdminSetting('resend_api_key', apiKey.trim())
  }
  if (from !== undefined) {
    await setAdminSetting('resend_from', from.trim())
  }

  return NextResponse.json({ ok: true })
}
