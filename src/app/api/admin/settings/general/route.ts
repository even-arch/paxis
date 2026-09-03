import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSystemSetting, setSystemSetting } from '@/lib/system-settings'
import { verifyAdminToken, ADMIN_COOKIE } from '@/lib/admin-auth'

async function checkAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE)?.value
  return token ? verifyAdminToken(token) : false
}

export async function GET(req: NextRequest) {
  if (!await checkAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const val = await getSystemSetting('allow_tenant_delete')
  return NextResponse.json({ allowTenantDelete: val === 'true' })
}

export async function POST(req: NextRequest) {
  if (!await checkAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { allowTenantDelete } = await req.json()
  await setSystemSetting('allow_tenant_delete', allowTenantDelete ? 'true' : 'false')
  return NextResponse.json({ ok: true })
}
