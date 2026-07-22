/**
 * POST /api/shipments/[id]/customs-docs/apply
 * 套用單一建議動作（人工按確認才會呼叫，AI 解析本身不會自動寫入）：
 * - action: 'hts'          → 回填 PRD_Product.htsCode
 * - action: 'freight_item' → 建立 SLS_FobCostItem（貨代費用項目）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

type Params = { params: { id: string } }

type ApplyBody =
  | { action: 'hts'; productId: number; htsCode: string }
  | { action: 'freight_item'; name: string; amountTWD: number; note?: string | null }

export async function POST(req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = Number(params.id)
  if (isNaN(shipmentId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const body = await req.json() as ApplyBody

  if (body.action === 'hts') {
    if (!body.productId || !body.htsCode?.trim()) {
      return NextResponse.json({ error: 'productId 與 htsCode 必填' }, { status: 400 })
    }
    // 只在目前為空時才寫入，避免與畫面上「已有值不覆蓋」的判斷競態
    const product = await prisma.pRD_Product.findUnique({ where: { id: body.productId }, select: { htsCode: true } })
    if (!product) return NextResponse.json({ error: '找不到產品' }, { status: 404 })
    if (product.htsCode?.trim()) {
      return NextResponse.json({ error: '此產品已有 HTS Code，不覆蓋' }, { status: 409 })
    }
    await prisma.pRD_Product.update({ where: { id: body.productId }, data: { htsCode: body.htsCode.trim() } })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'freight_item') {
    if (!body.name?.trim() || body.amountTWD == null) {
      return NextResponse.json({ error: 'name 與 amountTWD 必填' }, { status: 400 })
    }
    const shipment = await prisma.sLS.findUnique({ where: { id: shipmentId }, select: { id: true } })
    if (!shipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const item = await prisma.sLS_FobCostItem.create({
      data: {
        shipmentId,
        name: body.name.trim(),
        amountTWD: body.amountTWD,
        note: body.note ?? '由報關文件（貨代發票）AI 解析建立',
      },
      select: { id: true },
    })
    return NextResponse.json({ ok: true, itemId: item.id })
  }

  return NextResponse.json({ error: '未知的 action' }, { status: 400 })
}
