/**
 * POST /api/shipping/schedule-pickup
 * 呼叫 UPS Pickup API 預約提貨，並把確認號寫回 UPS_ShipmentLog。
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { getSystemSetting, setSystemSetting } from '@/lib/system-settings'
import { getUpsAccessToken } from '@/lib/shipping/ups-auth'
import { scheduleUpsPickup } from '@/lib/shipping/ups-pickup'

interface SchedulePickupBody {
  logId: number          // UPS_ShipmentLog.id
  pickupDate: string     // YYYYMMDD
  readyTime: string      // HHmm（24小時）
  closeTime: string      // HHmm
  contactPhone: string
  contactName?: string
  totalWeightKg: number
  quantity: number
  serviceCode: string
  // 提貨地址（通常跟發貨地一樣，但允許覆蓋）
  companyName: string
  addressLine: string
  city: string
  stateProvinceCode?: string
  postalCode: string
  countryCode: string
}

export async function POST(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as SchedulePickupBody

  if (!body.logId || !body.pickupDate || !body.readyTime || !body.closeTime || !body.contactPhone) {
    return NextResponse.json({ error: '缺少必填欄位：logId, pickupDate, readyTime, closeTime, contactPhone' }, { status: 400 })
  }

  try {
    const dbAccountNo = await getSystemSetting('ups_xinosys_account_no')
    const accountNo = dbAccountNo?.trim() || process.env.XINOSYS_UPS_ACCOUNT_NO || process.env.UPS_ACCOUNT_NO
    if (!accountNo) {
      return NextResponse.json({ error: 'UPS 帳號未設定' }, { status: 503 })
    }

    // 取 log 的 piNo 當 referenceNo
        const logs = await prisma.$queryRaw<Array<{ piNo: string | null }>>`
      SELECT "piNo" FROM "UPS_ShipmentLog" WHERE id = ${body.logId} LIMIT 1
    `
    const piNo = logs[0]?.piNo ?? undefined

    const accessToken = await getUpsAccessToken()

    const result = await scheduleUpsPickup({
      accessToken,
      accountNumber: accountNo,
      pickupDate: body.pickupDate,
      readyTime: body.readyTime,
      closeTime: body.closeTime,
      serviceCode: body.serviceCode,
      totalWeightKg: body.totalWeightKg,
      quantity: body.quantity,
      referenceNo: piNo,
      pickupAddress: {
        companyName: body.companyName,
        addressLine: body.addressLine,
        city: body.city,
        stateProvinceCode: body.stateProvinceCode,
        postalCode: body.postalCode,
        countryCode: body.countryCode,
        phone: body.contactPhone,
        contactName: body.contactName,
      },
    })

    // 寫回 log
    const pickupDate = body.pickupDate
    const readyHH = body.readyTime.slice(0, 2)
    const readyMM = body.readyTime.slice(2, 4)
    const readyISO = `${pickupDate.slice(0,4)}-${pickupDate.slice(4,6)}-${pickupDate.slice(6,8)}T${readyHH}:${readyMM}:00+08:00`

    await prisma.$queryRaw`
      UPDATE "UPS_ShipmentLog"
      SET
        "pickupConfirmationNo" = ${result.confirmationNumber},
        "pickupReadyTime" = ${readyISO}::timestamptz,
        "pickupScheduledDate" = ${readyISO}::timestamptz
      WHERE id = ${body.logId}
    `

    return NextResponse.json({
      ok: true,
      confirmationNumber: result.confirmationNumber,
      dueDate: result.dueDate,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '預約提貨失敗'
    console.error('[schedule-pickup]', err)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
