import { NextRequest, NextResponse } from 'next/server'
import { getRequestPrisma } from '@/lib/request-db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendShippingNoticeEmail } from '@/lib/mailer'
import { prisma as globalPrisma } from '@/lib/db'

type Params = { params: { id: string } }

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  try {
    const notice = await globalPrisma.pO_ShippingNotice.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, email: true, contactPerson: true } },
        items: {
          include: {
            po: { select: { poNo: true } },
            product: { select: { sku: true, name: true } },
          },
        },
        sourceShipment: { select: { shippingMarks: true } },
      },
    })

    if (!notice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!notice.supplier.email) {
      return NextResponse.json({ error: '供應商未設定 Email 地址' }, { status: 400 })
    }

    // 取得公司資訊
    const company = await globalPrisma.sYS_Company.findFirst()

    // 準備郵件資料
    const emailData = {
      noticeNo: notice.noticeNo,
      supplierName: notice.supplier.name,
      supplierContact: notice.supplier.contactPerson,
      issueDate: notice.issueDate.toISOString().slice(0, 10),
      deliverToName: notice.deliverToName,
      deliverToAddress: notice.deliverToAddress,
      deliverToContact: notice.deliverToContact,
      shippingMarks: notice.sourceShipment?.shippingMarks ?? null,
      items: notice.items.map(item => ({
        poNo: item.po.poNo,
        productSku: item.product.sku,
        productName: item.product.name,
        notifiedQuantity: item.notifiedQuantity,
        unit: item.unit || 'PCS',
      })),
      companyName: company?.nameZh || company?.nameEn || 'PAXIS',
      companyEmail: company?.email,
      noticeUrl: `${process.env.NEXTAUTH_URL}/purchases/shipping-notices/${id}`,
    }

    // 發送郵件
    await sendShippingNoticeEmail(notice.supplier.email, emailData)

    // 更新狀態為 SENT
    const updated = await globalPrisma.pO_ShippingNotice.update({
      where: { id },
      data: { status: 'SENT' },
    })

    return NextResponse.json({ ok: true, notice: updated })
  } catch (err) {
    console.error('[shipping-notices send-email]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
