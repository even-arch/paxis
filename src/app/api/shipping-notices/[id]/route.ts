import { NextRequest, NextResponse } from 'next/server'
import { getRequestPrisma } from '@/lib/request-db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const notice = await prisma.pO_ShippingNotice.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, email: true, contactPerson: true, phoneNo: true, address: true, city: true, countryCode: true } },
      items: {
        include: {
          po: { select: { id: true, poNo: true } },
          product: { select: { id: true, sku: true, name: true, unit: true } },
        },
      },
      performer: { select: { id: true, name: true } },
    },
  })

  if (!notice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ notice })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const body = await req.json()
  const { status, note, deliverToName, deliverToAddress, deliverToContact } = body

  const existing = await prisma.pO_ShippingNotice.findUnique({
    where: { id },
    select: { status: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updateData: Record<string, unknown> = {}
  if (status) updateData.status = status
  if (note !== undefined) updateData.note = note
  if (deliverToName !== undefined) updateData.deliverToName = deliverToName || null
  if (deliverToAddress !== undefined) updateData.deliverToAddress = deliverToAddress || null
  if (deliverToContact !== undefined) updateData.deliverToContact = deliverToContact || null

  const notice = await prisma.pO_ShippingNotice.update({
    where: { id },
    data: updateData,
    include: {
      supplier: { select: { id: true, name: true, email: true } },
      items: { include: { po: { select: { poNo: true } }, product: { select: { sku: true, name: true } } } },
    },
  })

  return NextResponse.json({ notice })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const existing = await prisma.pO_ShippingNotice.findUnique({
    where: { id },
    select: { status: true, noticeNo: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 任何狀態都可以退回，直接刪除（cascade 會自動刪除 items）
  await prisma.pO_ShippingNotice.delete({ where: { id } })
  return NextResponse.json({ ok: true, noticeNo: existing.noticeNo })
}
