import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendMail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { to } = await req.json() as { to?: string }
  if (!to || !to.includes('@')) {
    return NextResponse.json({ error: '請提供收件 Email' }, { status: 400 })
  }

  const config = await prisma.sYS_EmailConfig.findFirst({ where: { isActive: true } })
  if (!config?.encryptedApiKey) {
    return NextResponse.json({ error: '尚未設定 API Key' }, { status: 400 })
  }

  try {
    await sendMail({
      to,
      subject: 'PAXIS — Email 設定測試',
      html: `
        <div style="font-family:sans-serif;padding:24px">
          <h3 style="color:#1e40af">Email 設定測試成功 ✓</h3>
          <p style="color:#374151">此信件由 PAXIS 系統透過 Resend 發出，表示您的 Email 設定正常運作。</p>
          <p style="color:#6b7280;font-size:13px">發件人：${config.fromEmail}</p>
        </div>
      `,
    })

    await prisma.sYS_EmailConfig.update({
      where: { id: config.id },
      data: { lastTestedAt: new Date(), lastTestStatus: 'ok', lastTestMsg: null },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await prisma.sYS_EmailConfig.update({
      where: { id: config.id },
      data: { lastTestedAt: new Date(), lastTestStatus: 'error', lastTestMsg: msg },
    })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
