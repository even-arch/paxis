import { Resend } from 'resend'
import { getAdminSetting } from './admin-settings'

interface MailOptions {
  to: string
  subject: string
  html: string
}

// 系統級寄信（admin 邀請、確認信等）
// 優先讀 master DB 的設定，fallback 到 SYSTEM_RESEND_API_KEY 環境變數
export async function sendSystemMail(opts: MailOptions) {
  const dbApiKey = await getAdminSetting('resend_api_key').catch(() => null)
  const apiKey = dbApiKey || process.env.SYSTEM_RESEND_API_KEY
  if (!apiKey) throw new Error('尚未設定系統寄信 API Key，請至 Admin → 設定 → 郵件 配置')

  const dbFrom = await getAdminSetting('resend_from').catch(() => null)
  const from = dbFrom || 'PAXIS <noreply@paxis.tw>'

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  })
  if (error) throw new Error(error.message)
}
