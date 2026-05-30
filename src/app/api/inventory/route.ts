import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const filter = searchParams.get('filter') ?? ''

  const products = await prisma.pRD_Product.findMany({
    where: search
      ? { isActive: true, OR: [{ name: { contains: search } }, { sku: { contains: search } }] }
      : { isActive: true },
    select: { id: true, name: true, sku: true, unit: true },
    orderBy: { name: 'asc' },
  })

  const stocks = await prisma.iNV_Stock.findMany({
    where: { productId: { in: products.map(p => p.id) } },
  })

  const stockMap = new Map(stocks.map(s => [s.productId, s]))

  let result = products.map(p => {
    const s = stockMap.get(p.id)
    return { product: p, quantity: s?.quantity ?? 0, safetyStock: s?.safetyStock ?? 0 }
  })

  if (filter === 'low') {
    result = result.filter(r => r.quantity <= r.safetyStock)
  }

  return NextResponse.json(result)
}
