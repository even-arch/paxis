import { NextResponse } from 'next/server'
import { masterPrisma } from '@/lib/master-db'
import bcrypt from 'bcryptjs'

export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  const invite = await masterPrisma.oRG_Invite.findUnique({
    where: { token: params.token },
  })

  if (!invite) return NextResponse.json({ error: '邀請連結無效' }, { status: 404 })
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: '邀請連結已過期' }, { status: 410 })
  if (invite.usedAt) return NextResponse.json({ error: '邀請連結已使用' }, { status: 409 })

  const { companyName, slug, adminEmail, adminPassword } = await req.json()

  if (!companyName || !slug || !adminEmail || !adminPassword) {
    return NextResponse.json({ error: '所有欄位均為必填' }, { status: 400 })
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Slug 只能含小寫英數字與連字號' }, { status: 400 })
  }
  if (adminPassword.length < 8) {
    return NextResponse.json({ error: '密碼至少 8 個字元' }, { status: 400 })
  }

  // Check slug uniqueness
  const existing = await masterPrisma.oRG.findUnique({ where: { slug } })
  if (existing) return NextResponse.json({ error: '此識別碼已被使用，請選擇其他名稱' }, { status: 409 })

  const hashedPassword = await bcrypt.hash(adminPassword, 12)

  // Create org (status=pending, no DB yet — Even will activate)
  const org = await masterPrisma.oRG.create({
    data: {
      slug,
      name: companyName,
      ownerEmail: adminEmail,
      status: 'pending',
      databaseUrl: '',
      // Store hashed admin password temporarily in a separate field
      // We'll use it when provisioning the first user in the org DB
    },
  })

  // Store initial user credentials in invite record's orgId (link invite to org)
  // and save password hash in a temp field on org (added below via raw update)
  // Since we can't store the password in master DB cleanly, we use a separate approach:
  // save encrypted credentials in the invite's orgId + a dedicated column
  await masterPrisma.oRG_Invite.update({
    where: { token: params.token },
    data: {
      orgId: org.id,
      usedAt: new Date(),
    },
  })

  // Save the hashed password in a stable location (we'll use it at activation time)
  // Store as JSON in a new field — but our schema doesn't have one yet
  // Instead, write a pending-credentials file approach: store in master DB org.databaseUrl
  // temporarily as a JSON blob (until activation overwrites it with real URL)
  const pendingCreds = JSON.stringify({ adminEmail, hashedPassword })
  await masterPrisma.oRG.update({
    where: { id: org.id },
    data: { databaseUrl: `__pending__${pendingCreds}` },
  })

  return NextResponse.json({ ok: true })
}
