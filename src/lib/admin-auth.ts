import { createHmac } from 'crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const COOKIE_NAME = 'paxis-admin'
const COOKIE_MAX_AGE = 60 * 60 * 24 // 24 hours

function sign(payload: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? 'dev-secret'
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function makeAdminToken(): string {
  const issued = Date.now().toString()
  const sig = sign(`admin:${issued}`)
  return Buffer.from(JSON.stringify({ issued, sig })).toString('base64url')
}

export function verifyAdminToken(token: string): boolean {
  try {
    const { issued, sig } = JSON.parse(Buffer.from(token, 'base64url').toString())
    if (sign(`admin:${issued}`) !== sig) return false
    // expire after 24h
    if (Date.now() - Number(issued) > COOKIE_MAX_AGE * 1000) return false
    return true
  } catch {
    return false
  }
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/admin',
    maxAge: COOKIE_MAX_AGE,
  }
}

export const ADMIN_COOKIE = COOKIE_NAME

/** Server Component guard — redirects to /admin/login if not authenticated */
export async function requireAdminAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE)?.value
  if (!token || !verifyAdminToken(token)) {
    redirect('/admin/login')
  }
}
