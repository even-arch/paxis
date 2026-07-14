import { NextRequest, NextResponse } from 'next/server'
import { taipeiDateISO } from '@/lib/utils'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const prisma = await getRequestPrisma()

  const poId = Number(params.id)
  if (isNaN(poId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  try {
    // 查詢該 PO 在所有通知單中的紀錄（按時間順序）
    const history = await prisma.pO_ShippingNoticeItem.findMany({
      where: { poId },
      include: {
        notice: { select: { id: true, noticeNo: true, issueDate: true, status: true } },
        product: { select: { id: true, sku: true, name: true } },
      },
      orderBy: { notice: { issueDate: 'asc' } },
    })

    // 格式化為群組（按通知單組織）
    const grouped: Record<string, any> = {}
    for (const item of history) {
      const key = `${item.notice.id}`
      if (!grouped[key]) {
        grouped[key] = {
          noticeId: item.notice.id,
          noticeNo: item.notice.noticeNo,
          issueDate: taipeiDateISO(item.notice.issueDate),
          status: item.notice.status,
          items: [],
        }
      }
      grouped[key].items.push({
        productSku: item.product.sku,
        productName: item.product.name,
        notifiedQuantity: item.notifiedQuantity,
      })
    }

    const historyArray = Object.values(grouped)

    return NextResponse.json({ poId, history: historyArray })
  } catch (err) {
    console.error('[shipping-notices po history]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
