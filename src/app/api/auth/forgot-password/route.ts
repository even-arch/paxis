import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { randomBytes } from 'crypto'
import { sendPasswordResetEmail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email?: string }

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: '請輸入有效的 Email' }, { status: 400 })
  }

  // 不論是否找到帳號，一律回傳成功（防止帳號枚舉攻擊）
  const user = await prisma.sYS_User.findUnique({ where: { loginId: email.toLowerCase() } })

  if (user && user.isEnabled) {
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 小時

    await prisma.sYS_PasswordReset.create({
      data: { userId: user.id, token, expiresAt },
    })

    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    const company = await prisma.sYS_Company.findFirst({ where: { id: 1 } })
    const companyName = company?.nameEn || company?.nameZh || 'PAXIS'

    try {
      await sendPasswordResetEmail(email, resetUrl, companyName)
    } catch (err) {
      console.error('[forgot-password] email send failed:', err)
      // SMTP 未設定時，開發模式下印出連結
      if (process.env.NODE_ENV !== 'production') {
        console.log('[forgot-password] reset URL:', resetUrl)
        return NextResponse.json({ ok: true, devResetUrl: resetUrl })
      }
      return NextResponse.json({ error: '寄信失敗，請聯絡系統管理員' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
