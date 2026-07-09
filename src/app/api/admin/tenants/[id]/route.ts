import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken, ADMIN_COOKIE } from '@/lib/admin-auth'
import { masterPrisma } from '@/lib/master-db'
import { getOrgPrisma } from '@/lib/org-db'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'

async function assertAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE)?.value
  return token ? verifyAdminToken(token) : false
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const orgId = Number(params.id)
  const body = await req.json() as { action: string; upsMode?: string; upsAccountNo?: string | null }

  if (body.action === 'set_ups') {
    const org = await masterPrisma.oRG.findUnique({ where: { id: orgId }, select: { databaseUrl: true, slug: true } })
    if (!org?.databaseUrl || org.databaseUrl.startsWith('__pending__')) {
      return NextResponse.json({ error: '租戶 DB 尚未開通' }, { status: 400 })
    }

    const db = getOrgPrisma(org.databaseUrl, org.slug) as typeof prisma
    const upsert = (key: string, value: string) =>
      db.sYS_KeyValue.upsert({ where: { key }, create: { key, value }, update: { value } })

    if (body.upsMode === 'managed') {
      await upsert('ups_mode', 'managed')
      await upsert('ups_own_account_no', '')
    } else if (body.upsMode === 'own') {
      const accountNo = (body.upsAccountNo ?? '').trim()
      if (!accountNo) return NextResponse.json({ error: '請輸入 UPS Account Number' }, { status: 400 })
      await upsert('ups_mode', 'disabled')
      await upsert('ups_own_account_no', accountNo)
    } else {
      await upsert('ups_mode', 'disabled')
      await upsert('ups_own_account_no', '')
    }

    return NextResponse.json({ ok: true, upsMode: body.upsMode })
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 })
}

export async function GET() { return NextResponse.json({ error: 'SaaS disabled' }, { status: 503 }) }
export async function POST() { return NextResponse.json({ error: 'SaaS disabled' }, { status: 503 }) }
export async function DELETE() { return NextResponse.json({ error: 'SaaS disabled' }, { status: 503 }) }
