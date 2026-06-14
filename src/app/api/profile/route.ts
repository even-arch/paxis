import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import bcrypt from 'bcryptjs'

export async function GET() {
  const prisma = await getRequestPrisma()
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 先用 id 查，找不到就用 email（loginId）fallback，相容舊 JWT
  let user = await prisma.sYS_User.findUnique({
    where: { id: Number(session.user.id) },
    select: { id: true, name: true, loginId: true },
  })
  if (!user && session.user.email) {
    user = await prisma.sYS_User.findFirst({
      where: { loginId: session.user.email },
      select: { id: true, name: true, loginId: true },
    })
  }
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json(user)
}

// 改 email（loginId）
export async function PUT(req: NextRequest) {
  const prisma = await getRequestPrisma()
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, email, currentPassword, newPassword } = await req.json() as {
    name?: string
    email?: string
    currentPassword?: string
    newPassword?: string
  }

  let user = await prisma.sYS_User.findUnique({ where: { id: Number(session.user.id) } })
  if (!user && session.user.email) {
    user = await prisma.sYS_User.findFirst({ where: { loginId: session.user.email } })
  }
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const updates: Record<string, string> = {}

  if (name?.trim()) updates.name = name.trim()

  if (email && email !== user.loginId) {
    // email 格式驗證
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email 格式不正確' }, { status: 400 })
    }
    // 檢查是否已被使用
    const existing = await prisma.sYS_User.findUnique({ where: { loginId: email.toLowerCase() } })
    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: '此 Email 已被使用' }, { status: 400 })
    }
    updates.loginId = email.toLowerCase()
  }

  if (newPassword) {
    if (newPassword.length < 8) {
      return NextResponse.json({ error: '新密碼至少 8 個字元' }, { status: 400 })
    }
    if (!currentPassword) {
      return NextResponse.json({ error: '請輸入目前密碼' }, { status: 400 })
    }
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) {
      return NextResponse.json({ error: '目前密碼不正確' }, { status: 400 })
    }
    updates.password = await bcrypt.hash(newPassword, 10)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '沒有要更新的資料' }, { status: 400 })
  }

  await prisma.sYS_User.update({ where: { id: user.id }, data: updates })
  return NextResponse.json({ ok: true })
}
