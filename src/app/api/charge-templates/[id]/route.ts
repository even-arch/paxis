import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

type Ctx = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const template = await prisma.pRN_ChargeTemplate.findUnique({
    where: { id: Number(params.id) },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(template)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  const { name, description, items } = await req.json() as {
    name: string
    description?: string
    items: { name: string; calcType: string; calcBase: string; rate: number; currency?: string; accountCategory: string; sortOrder?: number }[]
  }

  // 刪掉舊 items，重建新的（最簡單的全量更新）
  await prisma.pRN_ChargeTemplateItem.deleteMany({ where: { templateId: id } })

  const template = await prisma.pRN_ChargeTemplate.update({
    where: { id },
    data: {
      name,
      description,
      items: { create: items.map((item, i) => ({ ...item, sortOrder: item.sortOrder ?? i })) },
    },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })

  return NextResponse.json(template)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.pRN_ChargeTemplate.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
