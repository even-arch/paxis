import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

type Params = { params: { productId: string } }

export async function GET(_req: NextRequest, {
  params }: Params) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const productId = Number(params.productId)

  const [stock, movements] = await Promise.all([
    prisma.iNV_Stock.findUnique({
      where: { productId },
      include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
    }),
    prisma.iNV_Movement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  return NextResponse.json({ stock, movements })
}

/** 更新安全庫存 */
export async function PATCH(req: NextRequest, {
  params }: Params) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const productId = Number(params.productId)

  const stock = await prisma.iNV_Stock.update({
    where: { productId },
    data: { safetyStock: Number(body.safetyStock) },
  })

  return NextResponse.json(stock)
}
