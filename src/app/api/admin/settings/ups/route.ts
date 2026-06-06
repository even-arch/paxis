import { NextRequest, NextResponse } from 'next/server'
import { getSystemSetting, setSystemSetting } from '@/lib/system-settings'

export async function GET(req: NextRequest) {
  
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
  
  const { accountNo, discountMultiplier } = await req.json()

  // 帳號（可為空字串，代表清除）
  if (accountNo !== undefined) {
    await setSystemSetting('ups_xinosys_account_no', accountNo?.trim() ?? '')
  }

  // 折扣係數
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
}
