import EmailConfigForm from './EmailConfigForm'

export default function EmailSettingsPage() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">Email 寄信設定</h1>
      <p className="text-sm text-gray-500 mb-6">
        使用您自己的 Resend 帳號寄送系統信件（密碼重設、出貨通知單等）。
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
        <p className="font-semibold mb-2">📋 對外信件的自動備份（BCC）</p>
        <ul className="space-y-1 text-blue-700 list-disc pl-5">
          <li>寄送<strong>出貨通知單</strong>時，系統會自動以密件副本（BCC）寄一份到<strong>按下寄送者本人的登入 Email</strong>，收件的供應商不會看到這個備份地址。</li>
          <li>備份信與實際寄出的信完全相同（含 PDF 附件），可作為寄送內容的存證。</li>
          <li>誰按寄送、備份就到誰的信箱；不同同事各自留有自己經手的紀錄。</li>
          <li>此功能為系統內建，無需設定。</li>
        </ul>
      </div>

      <EmailConfigForm />
    </div>
  )
}
