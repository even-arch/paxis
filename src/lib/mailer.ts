import nodemailer from 'nodemailer'

function getTransport() {
  const host = process.env.SMTP_HOST
  if (!host) throw new Error('未設定 SMTP_HOST，無法寄送 Email')

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, companyName: string) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@paxis.app'
  const transporter = getTransport()

  await transporter.sendMail({
    from: `"${companyName}" <${from}>`,
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
