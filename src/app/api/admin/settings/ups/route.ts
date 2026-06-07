import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSystemSetting, setSystemSetting, ensureKeyValueTable } from '@/lib/system-settings'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [dbAccountNo, dbMultiplier] = await Promise.all([
    getSystemSetting('ups_xinosys_account_no'),
    getSystemSetting('ups_discount_multiplier'),
  ])

  const effective = dbAccountNo?.trim() || null
  const hasEnv = !!process.env.XINOSYS_UPS_ACCOUNT_NO
  const source: 'db' | 'env' | 'none' =
    effective ? 'db' : hasEnv ? 'env' : 'none'

  return NextResponse.json({
    dbAccountNo: effective,
    source,
    discountMultiplier: dbMultiplier ? parseFloat(dbMultiplier) : null,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // 確保 SYS_KeyValue 表存在（第一次使用時自動建立）
    await ensureKeyValueTable()

    const { accountNo, discountMultiplier } = await req.json()

    if (accountNo !== undefined) {
      await setSystemSetting('ups_xinosys_account_no', accountNo?.trim() ?? '')
    }

    if (discountMultiplier !== undefined) {
      if (discountMultiplier === null) {
        await setSystemSetting('ups_discount_multiplier', '')
      } else {
        const n = parseFloat(discountMultiplier)
        if (isNaN(n) || n <= 0 || n > 1) {
          return NextResponse.json({ error: '折扣係數必須介於 0（不含）至 1' }, { status: 400 })
        }
        await setSystemSetting('ups_discount_multiplier', String(n))
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[ups settings]', err)
    return NextResponse.json({ error: `儲存失敗：${(err as Error).message}` }, { status: 500 })
  }
}
