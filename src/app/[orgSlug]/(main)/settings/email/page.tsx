import EmailConfigForm from './EmailConfigForm'

export default function EmailSettingsPage() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">Email 寄信設定</h1>
      <p className="text-sm text-gray-500 mb-6">
        使用您自己的 Resend 帳號寄送系統信件（密碼重設等）。
      </p>
      <EmailConfigForm />
    </div>
  )
}
