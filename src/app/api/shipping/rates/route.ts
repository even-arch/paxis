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
import { getRequestPrisma } from '@/lib/request-db'
import { resolveUpsCreds } from '@/lib/ups'
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
    const tenantDb = await getRequestPrisma()
    const creds = await resolveUpsCreds(tenantDb)

    if (!creds) {
      return NextResponse.json({ error: 'UPS 服務尚未開通，請聯繫錫諾系統或至「設定 → UPS」設定自有帳號', upsNotEnabled: true }, { status: 503 })
    }

    const { accountNo, discountMultiplier, source } = creds

    const accessToken = await getUpsAccessToken()
    const options = await getUpsRates(
      accessToken,
      accountNo,
      body.origin,
      body.destination,
      body.packages,
      body.declaredValueUsd,
    )

    // 套用費率：managed 來源只對基本運費加乘，附加費不加；own 來源原樣輸出
    const result = options.map(opt => {
      if (source === 'managed' && discountMultiplier != null && opt.chargeBreakdown?.baseCharge != null) {
        const { baseCharge, surcharges, taxAmount } = opt.chargeBreakdown
        const surchargesTotal = surcharges.reduce((s, c) => s + c.amount, 0)
        const markedUpAmount = parseFloat(
          (baseCharge * discountMultiplier + surchargesTotal + (taxAmount ?? 0)).toFixed(2)
        )
        return { ...opt, amount: markedUpAmount, contractEstimate: null }
      }
      return {
        ...opt,
        contractEstimate: discountMultiplier != null
          ? parseFloat((opt.amount * discountMultiplier).toFixed(2))
          : null,
      }
    })

    return NextResponse.json({
      options: result,
      discountMultiplier,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '運費查詢失敗'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
