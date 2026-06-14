import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function GET() {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const templates = await prisma.pRN_ChargeTemplate.findMany({
    include: { items: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, items } = await req.json() as {
    name: string
    description?: string
    items: { name: string; calcType: string; calcBase: string; rate: number; currency?: string; accountCategory: string; sortOrder?: number }[]
  }

  if (!name) return NextResponse.json({ error: '缺少名稱' }, { status: 400 })

  const template = await prisma.pRN_ChargeTemplate.create({
    data: {
      name,
      description,
      items: { create: items.map((item, i) => ({ ...item, sortOrder: item.sortOrder ?? i })) },
    },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })

  return NextResponse.json(template)
}
