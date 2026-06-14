import { Resend } from 'resend'

interface MailOptions {
  to: string
  subject: string
  html: string
}

// 系統級寄信（admin 邀請、確認信等），使用 SYSTEM_RESEND_API_KEY 環境變數
export async function sendSystemMail(opts: MailOptions) {
  const apiKey = process.env.SYSTEM_RESEND_API_KEY
  if (!apiKey) throw new Error('未設定 SYSTEM_RESEND_API_KEY')

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: 'PAXIS <noreply@paxis.tw>',
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  })
  if (error) throw new Error(error.message)
}
