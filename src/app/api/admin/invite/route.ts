import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminToken, ADMIN_COOKIE } from '@/lib/admin-auth'
import { masterPrisma } from '@/lib/master-db'
import { sendSystemMail } from '@/lib/system-mailer'
import { randomBytes } from 'crypto'

async function assertAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE)?.value
  console.log('[admin/invite] cookie names:', cookieStore.getAll().map(c => c.name))
  console.log('[admin/invite] paxis-admin token present:', !!token)
  if (token) console.log('[admin/invite] token valid:', verifyAdminToken(token))
  if (!token || !verifyAdminToken(token)) return false
  return true
}

export async function POST(req: Request) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'email 必填' }, { status: 400 })

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await masterPrisma.oRG_Invite.create({
    data: { email, token, expiresAt },
  })

  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://paxis.tw'
  const inviteUrl = `${baseUrl}/invite/${token}`

  await sendSystemMail({
    to: email,
    subject: 'PAXIS 系統邀請 — 請填寫公司資料',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
        <h2 style="color:#1e40af;margin-bottom:8px">歡迎加入 PAXIS</h2>
        <p style="color:#374151">您好，</p>
        <p style="color:#374151">
          您已收到 PAXIS 貿易管理系統的邀請。請點擊下方按鈕填寫公司資料並完成開通申請。
        </p>
        <a href="${inviteUrl}"
           style="display:inline-block;margin:24px 0;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:500">
          開始申請
        </a>
        <p style="color:#6b7280;font-size:13px">此邀請連結將在 <strong>7 天</strong>後失效。</p>
        <p style="color:#6b7280;font-size:13px">若您有任何問題，請聯繫 even@xinosys.com。</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
        <p style="color:#9ca3af;font-size:12px">PAXIS · 錫諾系統</p>
      </div>
    `,
  })

  return NextResponse.json({ ok: true })
}
