import { NextRequest, NextResponse } from 'next/server'
import { getSystemSetting, setSystemSetting } from '@/lib/system-settings'

export async function GET(req: NextRequest) {
    const val = await getSystemSetting('allow_tenant_delete')
  return NextResponse.json({ allowTenantDelete: val === 'true' })
}

export async function POST(req: NextRequest) {
    const { allowTenantDelete } = await req.json()
  await setSystemSetting('allow_tenant_delete', allowTenantDelete ? 'true' : 'false')
  return NextResponse.json({ ok: true })
}
