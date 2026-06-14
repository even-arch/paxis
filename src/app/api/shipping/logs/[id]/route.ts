/**
 * GET /api/shipping/logs/[id]
 * 取單筆 UPS_ShipmentLog，含 labelBase64（供重新下載標籤用）
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const rows = await prisma.$queryRaw<Array<{
    id: number
    trackingNumber: string
    serviceCode: string
    serviceName: string | null
    piNo: string | null
    chargedAmount: string | null
    chargedCurrency: string | null
    labelBase64: string | null
    labelFormat: string | null
    pickupConfirmationNo: string | null
    pickupScheduledDate: string | null
    destinationSnapshot: { name?: string; city?: string; countryCode?: string }
    createdAt: Date
  }>>`
    SELECT
      id, "trackingNumber", "serviceCode", "serviceName",
      "piNo", "chargedAmount", "chargedCurrency",
      "labelBase64", "labelFormat",
      "pickupConfirmationNo", "pickupScheduledDate",
      "destinationSnapshot", "createdAt"
    FROM "UPS_ShipmentLog"
    WHERE id = ${id}
    LIMIT 1
  `

  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ok: true, log: rows[0] })
}
