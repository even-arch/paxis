import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const { token, password } = await req.json() as { token?: string; password?: string }

  if (!token || !password || password.length < 8) {
    return NextResponse.json({ error: '密碼至少 8 個字元' }, { status: 400 })
  }

  const reset = await prisma.sYS_PasswordReset.findUnique({ where: { token } })

  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return NextResponse.json({ error: '連結已失效或已使用，請重新申請' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(password, 10)

  await prisma.$transaction([
    prisma.sYS_User.update({
      where: { id: reset.userId },
      data: { password: hashed },
    }),
    prisma.sYS_PasswordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
  ])

  return NextResponse.json({ ok: true })
}
