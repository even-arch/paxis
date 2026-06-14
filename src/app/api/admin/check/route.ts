import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminToken, ADMIN_COOKIE } from '@/lib/admin-auth'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE)?.value
  const allCookies = cookieStore.getAll().map(c => c.name)
  return NextResponse.json({
    hasCookie: !!token,
    tokenValid: token ? verifyAdminToken(token) : false,
    cookieNames: allCookies,
    cookieName: ADMIN_COOKIE,
  })
}
