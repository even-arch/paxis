import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'

interface MailOptions {
  to: string
  subject: string
  html: string
}

async function getResendConfig() {
    const config = await prisma.sYS_EmailConfig.findFirst({ where: { isActive: true } })
  if (!config?.encryptedApiKey) return null
  return {
    apiKey: decrypt(config.encryptedApiKey),
    from: config.fromName
      ? `${config.fromName} <${config.fromEmail}>`
      : config.fromEmail,
  }
}

async function sendViaResend(apiKey: string, from: string, opts: MailOptions) {
  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  })
  if (error) throw new Error(error.message)
}

async function sendViaSMTP(opts: MailOptions) {
  const host = process.env.SMTP_HOST
  if (!host) throw new Error('未設定 SMTP_HOST')

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@paxis.app'
  await transporter.sendMail({ from, ...opts })
}

// 主要寄信函式：優先 Resend（用戶設定），fallback SMTP（系統環境變數）
export async function sendMail(opts: MailOptions) {
  const resend = await getResendConfig()
  if (resend) {
    await sendViaResend(resend.apiKey, resend.from, opts)
    return
  }
  await sendViaSMTP(opts)
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, companyName: string) {
  await sendMail({
    to,
    subject: `${companyName} — 重設您的密碼`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#1e40af;margin-bottom:8px">${companyName}</h2>
        <p style="color:#374151">您好，</p>
        <p style="color:#374151">我們收到您的密碼重設請求。請點擊下方按鈕重設密碼：</p>
        <a href="${resetUrl}" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:500">
          重設密碼
        </a>
        <p style="color:#6b7280;font-size:13px">此連結將在 <strong>1 小時</strong>後失效。</p>
        <p style="color:#6b7280;font-size:13px">若您並未發出此請求，請忽略此信件。</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
        <p style="color:#9ca3af;font-size:12px">${companyName} · PAXIS 系統</p>
      </div>
    `,
  })
}

export interface ShippingNoticeEmailData {
  noticeNo: string
  supplierName: string
  supplierContact?: string | null
  issueDate: string
  deliverToName?: string | null
  deliverToAddress?: string | null
  deliverToContact?: string | null
  shippingMarks?: string | null
  items: Array<{
    poNo: string
    productSku: string | null
    productName: string
    notifiedQuantity: number
    unit: string
  }>
  companyName: string
  companyEmail?: string
  noticeUrl?: string
}

export async function sendShippingNoticeEmail(to: string, data: ShippingNoticeEmailData) {
  const {
    noticeNo, supplierName, supplierContact, issueDate,
    deliverToName, deliverToAddress, deliverToContact,
    shippingMarks, items, companyName, companyEmail, noticeUrl,
  } = data

  const itemsHtml = items.map(item => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:8px;text-align:left">${item.poNo}</td>
      <td style="padding:8px;text-align:left">${item.productSku || '—'}</td>
      <td style="padding:8px;text-align:left">${item.productName}</td>
      <td style="padding:8px;text-align:right">${item.notifiedQuantity}</td>
      <td style="padding:8px;text-align:center">${item.unit || 'PCS'}</td>
    </tr>
  `).join('')

  const html = `
    <div style="font-family:sans-serif;max-width:700px;margin:0 auto;padding:32px">
      <h2 style="color:#1e40af;margin-bottom:8px">${companyName}</h2>
      <p style="color:#374151">親愛的 ${supplierName}${supplierContact ? `（${supplierContact}）` : ''}，</p>
      <p style="color:#374151">我們特此通知您，以下訂單的貨物將準備出貨。請根據通知內容準備相應的產品。</p>

      <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:24px 0">
        <p style="color:#374151;margin:0 0 12px 0"><strong>出貨通知單號：</strong>${noticeNo}</p>
        <p style="color:#374151;margin:0"><strong>通知日期：</strong>${issueDate}</p>
      </div>

      ${(deliverToName || deliverToAddress) ? `
        <div style="background:#fefce8;border:1px solid #fde047;padding:16px;border-radius:8px;margin:24px 0">
          <h3 style="color:#a16207;margin:0 0 12px 0;font-size:15px">📦 交貨地點</h3>
          ${deliverToName ? `<p style="color:#374151;margin:0 0 8px 0"><strong>收貨方：</strong>${deliverToName}</p>` : ''}
          ${deliverToAddress ? `<p style="color:#374151;margin:0 0 8px 0"><strong>地址：</strong>${deliverToAddress}</p>` : ''}
          ${deliverToContact ? `<p style="color:#374151;margin:0"><strong>聯絡人：</strong>${deliverToContact}</p>` : ''}
        </div>
      ` : ''}

      <h3 style="color:#1e40af;margin:24px 0 12px 0">出貨品項清單</h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb">
        <thead style="background:#f9fafb">
          <tr>
            <th style="padding:8px;text-align:left;border-bottom:1px solid #d1d5db;font-weight:600">訂單號</th>
            <th style="padding:8px;text-align:left;border-bottom:1px solid #d1d5db;font-weight:600">產品 SKU</th>
            <th style="padding:8px;text-align:left;border-bottom:1px solid #d1d5db;font-weight:600">品名</th>
            <th style="padding:8px;text-align:right;border-bottom:1px solid #d1d5db;font-weight:600">數量</th>
            <th style="padding:8px;text-align:center;border-bottom:1px solid #d1d5db;font-weight:600">單位</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      ${shippingMarks ? `
        <h3 style="color:#1e40af;margin:24px 0 12px 0">嘜頭 Shipping Marks（請於出貨前核對）</h3>
        <pre style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;font-family:'Courier New',monospace;font-size:12px;color:#374151;white-space:pre-wrap;margin:0 0 8px 0">${shippingMarks}</pre>
        <p style="color:#6b7280;font-size:12px;margin:0 0 16px 0">請核對上列嘜頭、訂單號與箱號範圍是否與貴司備貨一致，如有出入請儘速告知。</p>
      ` : ''}

      <p style="color:#374151;margin:24px 0">請在準備好貨物後盡快回覆確認。如有任何問題，歡迎與我們聯繫。</p>

      ${noticeUrl ? `
        <a href="${noticeUrl}" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:500">
          查看完整通知單
        </a>
      ` : ''}

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
      <p style="color:#6b7280;font-size:13px;margin:0">聯絡我們：${companyEmail || 'noreply@paxis.app'}</p>
      <p style="color:#9ca3af;font-size:12px;margin:8px 0 0 0">${companyName} · PAXIS 系統</p>
    </div>
  `

  await sendMail({
    to,
    subject: `${companyName} — 出貨通知單 ${noticeNo}`,
    html,
  })
}
