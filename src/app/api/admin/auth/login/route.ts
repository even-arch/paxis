import { NextResponse } from 'next/server'
import { makeAdminToken, getAdminCookieOptions, ADMIN_COOKIE } from '@/lib/admin-auth'

export async function POST(req: Request) {
  const { email, password } = await req.json()

  if (
    email !== process.env.ADMIN_EMAIL ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })
  }

  const token = makeAdminToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, token, getAdminCookieOptions())
  return res
}
