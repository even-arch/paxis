/**
 * POST /api/finance/payment-vouchers/[id]/send-email
 * 寄送付款通知單 Email 給供應商
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { sendMail } from '@/lib/mailer'

type Params = { params: { id: string } }

export async function POST(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const voucher = await prisma.fIN_PaymentVoucher.findUnique({
    where: { id },
    include: {
      supplier: { select: { name: true, email: true, contactPerson: true, taxId: true } },
      items: {
        include: {
          payable: {
            include: { po: { select: { poNo: true, tradeTerms: true } } },
          },
        },
        orderBy: { id: 'asc' },
      },
      adjustments: { orderBy: { id: 'asc' } },
    },
  })

  if (!voucher) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!voucher.supplier.email) return NextResponse.json({ error: '供應商未設定 Email 地址' }, { status: 400 })

  const company = await prisma.sYS_Company.findFirst()

  const subtotal = voucher.items.reduce((s, i) => s + Number(i.amountTWD), 0)
  const adjustmentTotal = voucher.adjustments.reduce((s, a) => s + Number(a.amountTWD), 0)
  const afterAdj = subtotal + adjustmentTotal
  const vatAmt = Math.round(afterAdj * Number(voucher.vatPct) / 100)
  const total = afterAdj + vatAmt

  const fmt = (n: number) => `NT$ ${Math.round(n).toLocaleString()}`
  const companyName = company?.nameZh || company?.nameEn || 'PAXIS'

  const itemRows = voucher.items.map(i => {
    const poNo = i.payable.po?.poNo ?? `#${i.payableId}`
    const terms = i.payable.po?.tradeTerms ?? ''
    return `<tr>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;">${poNo}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center;">${terms}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;font-family:monospace;">${fmt(Number(i.amountTWD))}</td>
    </tr>`
  }).join('')

  const adjRows = voucher.adjustments.map(a => {
    const amt = Number(a.amountTWD)
    return `<tr>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;" colspan="2">${a.name}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;font-family:monospace;color:${amt < 0 ? '#c0392b' : '#000'};">
        ${amt < 0 ? `−NT$ ${Math.round(Math.abs(amt)).toLocaleString()}` : fmt(amt)}
      </td>
    </tr>`
  }).join('')

  const greeting = voucher.supplier.contactPerson ? `${voucher.supplier.contactPerson} 您好，` : '您好，'

  const html = `
    <div style="font-family:Arial,'Noto Sans TC',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
      <div style="font-size:18px;font-weight:bold;margin-bottom:4px;">${companyName}</div>
      <div style="font-size:13px;color:#888;margin-bottom:24px;">付款通知單</div>

      <p style="margin:0 0 16px;">${greeting}</p>
      <p style="margin:0 0 20px;">茲通知本次採購付款明細如下，請確認金額後回覆。</p>

      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
        <thead>
          <tr style="background:#1a4a2e;color:#fff;">
            <th style="padding:6px 8px;text-align:left;">採購單號</th>
            <th style="padding:6px 8px;text-align:center;">條款</th>
            <th style="padding:6px 8px;text-align:right;">金額</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          ${adjRows}
          <tr style="background:#f9fafb;font-weight:bold;">
            <td style="padding:8px;border-top:2px solid #1a4a2e;" colspan="2">實付總計（含稅 ${Number(voucher.vatPct)}%）</td>
            <td style="padding:8px;border-top:2px solid #1a4a2e;text-align:right;font-family:monospace;font-size:15px;">${fmt(total)}</td>
          </tr>
        </tbody>
      </table>

      <table style="font-size:12px;color:#555;margin-bottom:20px;">
        <tr><td style="padding:2px 8px 2px 0;">通知單號：</td><td style="font-weight:bold;">${voucher.voucherNo}</td></tr>
        <tr><td style="padding:2px 8px 2px 0;">日期：</td><td>${new Date(voucher.createdAt).toLocaleDateString('zh-TW')}</td></tr>
      </table>

      ${voucher.note ? `<div style="background:#f9f9f9;border-left:3px solid #ccc;padding:8px 12px;font-size:12px;margin-bottom:20px;">${voucher.note}</div>` : ''}

      <p style="margin:0 0 8px;font-size:13px;">如有任何疑問，請聯絡我們。感謝合作。</p>
      <p style="margin:0;font-size:12px;color:#888;">${companyName}${company?.email ? ` ∙ ${company.email}` : ''}${company?.phone ? ` ∙ ${company.phone}` : ''}</p>
    </div>
  `

  await sendMail(prisma, {
    to: voucher.supplier.email,
    subject: `【付款通知單 ${voucher.voucherNo}】請確認付款金額 — ${companyName}`,
    html,
    bcc: company?.email || undefined,
  })

  // 推進狀態至 SENT（若仍在 DRAFT）
  if (voucher.status === 'DRAFT') {
    await prisma.fIN_PaymentVoucher.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
    })
  }

  return NextResponse.json({ ok: true, sentTo: voucher.supplier.email })
}
