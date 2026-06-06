/**
 * POST /api/shipping/rates
 * 查詢運費報價，回傳 UnifiedShippingOption[]。
 * 若 Admin 設定了折扣係數，每個選項附帶 contractEstimate（契約估算金額）。
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUpsAccessToken } from '@/lib/shipping/ups-auth'
import { getUpsRates } from '@/lib/shipping/ups-rating'
import { getSystemSetting, setSystemSetting } from '@/lib/system-settings'
import type { GetRatesInput } from '@/lib/shipping/types'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as GetRatesInput

  if (!body.origin || !body.destination || !body.packages?.length) {
    return NextResponse.json({ error: '缺少必填欄位：origin, destination, packages' }, { status: 400 })
  }

  try {
    const [dbAccountNo, dbMultiplier] = await Promise.all([
      getSystemSetting('ups_xinosys_account_no'),
      getSystemSetting('ups_discount_multiplier'),
    ])

    const accountNo = dbAccountNo?.trim() || process.env.XINOSYS_UPS_ACCOUNT_NO || process.env.UPS_ACCOUNT_NO
    if (!accountNo) {
      return NextResponse.json({ error: 'UPS 帳號未設定，請至 /admin/settings/ups 設定' }, { status: 503 })
    }

    const discountMultiplier = dbMultiplier?.trim() ? parseFloat(dbMultiplier) : null

    const accessToken = await getUpsAccessToken()
    const options = await getUpsRates(
      accessToken,
      accountNo,
      body.origin,
      body.destination,
      body.packages,
      body.declaredValueUsd,
    )

    // 套用折扣係數
    const result = options.map(opt => ({
      ...opt,
      contractEstimate: discountMultiplier != null
        ? parseFloat((opt.amount * discountMultiplier).toFixed(2))
        : null,
    }))

    return NextResponse.json({
      options: result,
      discountMultiplier,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '運費查詢失敗'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
