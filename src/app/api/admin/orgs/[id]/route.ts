import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminToken, ADMIN_COOKIE } from '@/lib/admin-auth'
import { masterPrisma } from '@/lib/master-db'
import { provisionOrgDatabase } from '@/lib/neon-provision'
import { getOrgPrisma } from '@/lib/org-db'
import { sendSystemMail } from '@/lib/system-mailer'

async function assertAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE)?.value
  return token ? verifyAdminToken(token) : false
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const orgId = Number(params.id)
  const { action } = await req.json()

  if (action === 'suspend') {
    await masterPrisma.oRG.update({
      where: { id: orgId },
      data: { status: 'suspended' },
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'activate') {
    const org = await masterPrisma.oRG.findUnique({ where: { id: orgId } })
    if (!org) return NextResponse.json({ error: '找不到租戶' }, { status: 404 })

    let databaseUrl = org.databaseUrl

    // Parse pending credentials stored at onboarding time
    let pendingCreds: { adminEmail: string; hashedPassword: string } | null = null
    if (databaseUrl.startsWith('__pending__')) {
      try {
        pendingCreds = JSON.parse(databaseUrl.slice('__pending__'.length))
      } catch {
        return NextResponse.json({ error: '無法解析暫存憑證' }, { status: 500 })
      }
      databaseUrl = '' // not provisioned yet
    }

    // Provision DB if needed
    if (!databaseUrl) {
      try {
        databaseUrl = await provisionOrgDatabase(org.slug)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: `開通 DB 失敗：${msg}` }, { status: 500 })
      }
    }

    // Create first user in org DB if we have credentials
    if (pendingCreds) {
      try {
        const db = getOrgPrisma(databaseUrl, org.slug)
        await db.sYS_User.create({
          data: {
            name: org.name || org.ownerEmail,
            loginId: pendingCreds.adminEmail,
            password: pendingCreds.hashedPassword,
            isEnabled: true,
          },
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: `建立使用者失敗：${msg}` }, { status: 500 })
      }
    }

    await masterPrisma.oRG.update({
      where: { id: orgId },
      data: { databaseUrl, status: 'active' },
    })

    // Notify the org owner
    if (pendingCreds?.adminEmail) {
      const baseUrl = process.env.NEXTAUTH_URL ?? 'https://paxis.tw'
      await sendSystemMail({
        to: pendingCreds.adminEmail,
        subject: 'PAXIS 帳號已開通',
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
            <h2 style="color:#1e40af;margin-bottom:8px">您的 PAXIS 帳號已開通</h2>
            <p style="color:#374151">您好，</p>
            <p style="color:#374151">
              您的 PAXIS 系統帳號已完成開通。請前往以下網址登入：
            </p>
            <a href="${baseUrl}/${org.slug}/login"
               style="display:inline-block;margin:24px 0;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:500">
              前往登入
            </a>
            <p style="color:#6b7280;font-size:13px">登入網址：${baseUrl}/${org.slug}/login</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
            <p style="color:#9ca3af;font-size:12px">PAXIS · 錫諾系統</p>
          </div>
        `,
      }).catch(() => { /* 不因通知失敗而 rollback */ })
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 })
}
