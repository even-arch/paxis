import { NextRequest, NextResponse } from 'next/server'
import { getRequestPrisma } from '@/lib/request-db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const supplierId = searchParams.get('supplierId')
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 100)

  const notices = await prisma.pO_ShippingNotice.findMany({
    where: supplierId ? { supplierId: Number(supplierId) } : undefined,
    include: {
      supplier: { select: { id: true, name: true, shortName: true, email: true } },
      items: {
        include: { po: { select: { id: true, poNo: true } }, product: { select: { id: true, sku: true, name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ notices })
}

export async function POST(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawId = session?.user ? (session.user as unknown as { id?: number | string }).id : null
  const userId = rawId != null ? Number(rawId) : null

  const body = await req.json()
  const { supplierId, issueDate, note, items = [] } = body

  if (!supplierId) return NextResponse.json({ error: '請選擇供應商' }, { status: 400 })
  if (!items.length) return NextResponse.json({ error: '請至少新增一個品項' }, { status: 400 })

  try {
    // 生成流水號 SN-YYYYMMDD-XXXX
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const countToday = await prisma.pO_ShippingNotice.count({
      where: { noticeNo: { startsWith: `SN-${today}` } },
    })
    const noticeNo = `SN-${today}-${String(countToday + 1).padStart(4, '0')}`

    const notice = await prisma.pO_ShippingNotice.create({
      data: {
        noticeNo,
        supplierId: Number(supplierId),
        issueDate: new Date(issueDate),
        note: note || null,
        performedBy: userId,
        status: 'DRAFT',
        items: {
          create: (items as Array<{
            poId: number
            productId: number
            poQuantity: number
            notifiedQuantity: number
            unit?: string
            unitPrice?: number
          }>).map(it => ({
            poId: it.poId,
            productId: it.productId,
            poQuantity: it.poQuantity,
            notifiedQuantity: it.notifiedQuantity,
            unit: it.unit || null,
            unitPrice: it.unitPrice ? String(it.unitPrice) : null,
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true, email: true } },
        items: { include: { po: { select: { poNo: true } }, product: { select: { sku: true, name: true } } } },
      },
    })

    return NextResponse.json({ notice })
  } catch (err) {
    console.error('[shipping-notices POST]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
