/**
 * POST /api/shipping/create-shipment
 * 呼叫 UPS Shipping API 建提單，儲存紀錄並回傳 tracking number + label。
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getSystemSetting, setSystemSetting } from '@/lib/system-settings'
import { getUpsAccessToken } from '@/lib/shipping/ups-auth'
import { createUpsShipment } from '@/lib/shipping/ups-shipment'
import type { ShippingAddress, ShippingPackage } from '@/lib/shipping/types'

interface CreateShipmentBody {
  serviceCode: string
  serviceName?: string
  origin: ShippingAddress & { taxId?: string }
  destination: ShippingAddress & { taxId?: string }
  packages: Array<ShippingPackage & {
    items?: Array<{ sku?: string; modelNo?: string; desc?: string; specification?: string; qty?: string; unitPrice?: string; unit?: string; currencyCode?: string }>
  }>
  declaredValue?: number
  declaredCurrency?: string
  piId?: number
  piNo?: string
  /** 若要將 trackingNo 寫回 SLS_Shipment 記錄，傳入其 id */
  slsShipmentId?: number | null
  labelFormat?: 'GIF' | 'PNG' | 'PDF'
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as CreateShipmentBody

  if (!body.serviceCode || !body.origin || !body.destination || !body.packages?.length) {
    return NextResponse.json({ error: '缺少必填欄位' }, { status: 400 })
  }

  try {
    const [dbAccountNo] = await Promise.all([
      getSystemSetting('ups_xinosys_account_no'),
    ])
    const accountNo = dbAccountNo?.trim() || process.env.XINOSYS_UPS_ACCOUNT_NO || process.env.UPS_ACCOUNT_NO
    if (!accountNo) {
      return NextResponse.json({ error: 'UPS 帳號未設定，請至 /admin/settings/ups 設定' }, { status: 503 })
    }

    const accessToken = await getUpsAccessToken()

    const result = await createUpsShipment({
      accessToken,
      accountNumber: accountNo,
      serviceCode: body.serviceCode,
      shipper: body.origin,
      shipTo: body.destination,
      packages: body.packages,
      declaredValue: body.declaredValue,
      declaredCurrency: body.declaredCurrency,
      labelFormat: body.labelFormat ?? 'GIF',
      referenceNo: body.piNo,
    })

    // 儲存紀錄
        const log = await prisma.$queryRaw`
      INSERT INTO "UPS_ShipmentLog" (
        "trackingNumber", "upsShipmentId", "serviceCode", "serviceName",
        "piId", "piNo",
        "originSnapshot", "destinationSnapshot", "packagesSnapshot",
        "declaredValue", "declaredCurrency",
        "chargedAmount", "chargedCurrency",
        "labelBase64", "labelFormat",
        "createdByUserId"
      ) VALUES (
        ${result.trackingNumber},
        ${result.shipmentIdentificationNumber},
        ${body.serviceCode},
        ${body.serviceName ?? null},
        ${body.piId ?? null},
        ${body.piNo ?? null},
        ${JSON.stringify(body.origin)}::jsonb,
        ${JSON.stringify(body.destination)}::jsonb,
        ${JSON.stringify(body.packages)}::jsonb,
        ${body.declaredValue ?? null},
        ${body.declaredCurrency ?? null},
        ${result.chargedAmount ?? null},
        ${result.chargedCurrency ?? null},
        ${result.labelBase64},
        ${result.labelFormat},
        ${session.user.id ? parseInt(session.user.id) : null}
      )
      RETURNING id, "trackingNumber", "createdAt"
    `

    const logRow = Array.isArray(log) ? log[0] : log

    // 若有關聯的 SLS_Shipment，寫回 trackingNo
    if (body.slsShipmentId) {
      await prisma.sLS_Shipment.update({
        where: { id: body.slsShipmentId },
        data: {
          trackingNo: result.trackingNumber,
          shippingMethod: body.serviceCode.startsWith('11') ? 'AIR' : 'COURIER',
        },
      }).catch(e => console.warn('[create-shipment] update SLS_Shipment trackingNo failed:', e))
    }

    return NextResponse.json({
      ok: true,
      trackingNumber: result.trackingNumber,
      shipmentId: result.shipmentIdentificationNumber,
      labelBase64: result.labelBase64,
      labelFormat: result.labelFormat,
      chargedAmount: result.chargedAmount,
      chargedCurrency: result.chargedCurrency,
      allLabels: result.allLabels,
      logId: (logRow as { id: number }).id,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '建提單失敗'
    console.error('[create-shipment]', err)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
