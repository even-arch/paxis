import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const rawId = session?.user ? (session.user as unknown as { id?: number | string }).id : null
    const userId = rawId != null ? Number(rawId) : null

    const body = await req.json()
    const {
      docNo, customerId, slsPiId, slsOrderId,
      issueDate, deliveryDate,
      contactName, contactPhone, deliveryAddr, freightCo, vehicleNo,
      shippingMark, note, counterpartNo, items = [],
    } = body

    const dn = await prisma.sLS_DeliveryNote.create({
      data: {
        docNo,
        customerId:   customerId  ?? null,
        slsPiId:      slsPiId     ?? null,
        slsOrderId:   slsOrderId  ?? null,
        issueDate:    new Date(issueDate),
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        contactName:  contactName  || null,
        contactPhone: contactPhone || null,
        deliveryAddr: deliveryAddr || null,
        freightCo:    freightCo   || null,
        vehicleNo:    vehicleNo   || null,
        shippingMark: shippingMark || null,
        note:         note        || null,
        counterpartNo: counterpartNo || null,
        status: 'DRAFT',
        performedBy: userId,
        items: {
          create: (items as {
            productId?: number | null; description?: string
            quantity: number; unit?: string
            cartons?: number | null; grossWeightKg?: number | null
          }[]).map(it => ({
            productId:     it.productId    ?? null,
            description:   it.description  || null,
            quantity:      it.quantity,
            unit:          it.unit         || null,
            cartons:       it.cartons      ?? null,
            grossWeightKg: it.grossWeightKg != null ? it.grossWeightKg : null,
          })),
        },
      },
    })

    return NextResponse.json({ id: dn.id })
  } catch (err) {
    console.error('[delivery-notes POST]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
