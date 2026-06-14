import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const seals = await prisma.sYS_Seal.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, imageBase64: true },
  })
  return NextResponse.json(seals)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, imageBase64 } = await req.json() as { name: string; imageBase64: string }
  if (!imageBase64) return NextResponse.json({ error: '缺少圖片資料' }, { status: 400 })
  const sealName = name?.trim() || '公司章'

  const seal = await prisma.sYS_Seal.create({ data: { name: sealName, imageBase64 } })
  return NextResponse.json({ id: seal.id, name: seal.name, imageBase64: seal.imageBase64 })
}
