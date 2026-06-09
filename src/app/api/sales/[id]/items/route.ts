import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

type Params = { params: { id: string } }

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const itemId = Number(searchParams.get('itemId'))
  if (!itemId) return NextResponse.json({ error: '缺少 itemId' }, { status: 400 })

  const item = await prisma.sLS_Item.findUnique({
    where: { id: itemId },
    include: { piItems: { select: { id: true } } },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (Number(params.id) !== item.orderId)
    return NextResponse.json({ error: '品項不屬於此訂單' }, { status: 400 })
  if (item.shippedQty > 0)
    return NextResponse.json({ error: '此品項已有出貨記錄，無法刪除' }, { status: 400 })
  if (item.piItems.length > 0)
    return NextResponse.json({ error: '此品項已列入 PI，請先取消相關 PI 再刪除' }, { status: 400 })

  await prisma.sLS_Item.delete({ where: { id: itemId } })
  return NextResponse.json({ ok: true })
}
