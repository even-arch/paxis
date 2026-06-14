import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

type Ctx = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const template = await prisma.pRN_Template.findUnique({ where: { id: Number(params.id) } })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(template)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  const t = await prisma.pRN_Template.findUnique({ where: { id }, select: { isSystem: true } })
  if (t?.isSystem) return NextResponse.json({ error: '系統模板不可刪除' }, { status: 403 })

  await prisma.pRN_Template.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  const body = await req.json() as { setAsDefault?: boolean; name?: string; sealPlacements?: object[] }

  if (body.setAsDefault) {
    const t = await prisma.pRN_Template.findUnique({ where: { id }, select: { docType: true } })
    if (t) {
      await prisma.pRN_Template.updateMany({ where: { docType: t.docType, isDefault: true }, data: { isDefault: false } })
      await prisma.pRN_Template.update({ where: { id }, data: { isDefault: true } })
    }
  }

  const updates: Record<string, unknown> = {}
  if (body.name) updates.name = body.name
  if (body.sealPlacements !== undefined) updates.sealPlacements = body.sealPlacements
  if (Object.keys(updates).length > 0) {
    await prisma.pRN_Template.update({ where: { id }, data: updates })
  }

  return NextResponse.json({ ok: true })
}
