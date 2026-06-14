/**
 * GET /api/shipping/logs
 * 取最近的 UPS_ShipmentLog 紀錄
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function GET(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100)

    const logs = await prisma.$queryRaw<Array<{
    id: number
    trackingNumber: string
    upsShipmentId: string | null
    serviceCode: string
    serviceName: string | null
    piNo: string | null
    chargedAmount: string | null
    chargedCurrency: string | null
    pickupConfirmationNo: string | null
    pickupScheduledDate: string | null
    destinationSnapshot: { name?: string; city?: string; countryCode?: string }
    createdAt: Date
  }>>`
    SELECT
      id, "trackingNumber", "upsShipmentId", "serviceCode", "serviceName",
      "piNo", "chargedAmount", "chargedCurrency",
      "pickupConfirmationNo", "pickupScheduledDate",
      "destinationSnapshot", "createdAt"
    FROM "UPS_ShipmentLog"
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `

  return NextResponse.json({ logs })
}
