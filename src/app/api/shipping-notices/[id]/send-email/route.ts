import { NextRequest, NextResponse } from 'next/server'
import { taipeiDateISO } from '@/lib/utils'
import { getRequestPrisma } from '@/lib/request-db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendShippingNoticeEmail } from '@/lib/mailer'
import { renderShippingNoticePdf } from '@/lib/sn-pdf'
import { filterMarksForDocNos } from '@/lib/shipping-marks'

type Params = { params: { id: string } }

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const prisma = await getRequestPrisma()

  try {
    const notice = await prisma.pO_ShippingNotice.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, email: true, contactPerson: true } },
        items: {
          include: {
            po: { select: { poNo: true, slsPi: { select: { piNo: true } } } },
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
    const company = await prisma.sYS_Company.findFirst()

    // 準備郵件資料
    const emailData = {
      noticeNo: notice.noticeNo,
      supplierName: notice.supplier.name,
      supplierContact: notice.supplier.contactPerson,
      issueDate: taipeiDateISO(notice.issueDate),
      deliverToName: notice.deliverToName,
      deliverToAddress: notice.deliverToAddress,
      deliverToContact: notice.deliverToContact,
      shippingMarks: notice.sourceShipment?.shippingMarks
        ? filterMarksForDocNos(
            notice.sourceShipment.shippingMarks,
            notice.items.flatMap(item => [item.po.poNo, item.po.slsPi?.piNo].filter((s): s is string => !!s)),
          )
        : null,
      items: notice.items.map(item => ({
        poNo: item.po.poNo,
        productSku: item.product.sku,
        productName: item.product.name,
        notifiedQuantity: item.notifiedQuantity,
        unit: item.unit || 'PCS',
      })),
      companyName: company?.nameZh || company?.nameEn || 'PAXIS',
      companyEmail: company?.email,
      note: notice.note,
      // 供應商沒有 PAXIS 帳號，不放登入連結，改附 A4 PDF
    }

    // 產出 A4 PDF 附件
    const pdfBuffer = await renderShippingNoticePdf(emailData)

    // 發送郵件（附 PDF）
    await sendShippingNoticeEmail(prisma, notice.supplier.email, emailData, [
      { filename: `${notice.noticeNo}.pdf`, content: pdfBuffer },
    ])

    // 更新狀態為 SENT
    const updated = await prisma.pO_ShippingNotice.update({
      where: { id },
      data: { status: 'SENT' },
    })

    return NextResponse.json({ ok: true, notice: updated })
  } catch (err) {
    console.error('[shipping-notices send-email]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
