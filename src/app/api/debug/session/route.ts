import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// 暫時 debug 用 — 確認 session 在 Vercel 上是否正常
export async function GET() {
  const session = await getServerSession(authOptions)
  return NextResponse.json({
    hasSession: !!session,
    userId: session?.user?.id ?? null,
    email: session?.user?.email ?? null,
  })
}
