import AiConfigForm from './AiConfigForm'

export default function AiSettingsPage() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">AI 功能設定</h1>
      <p className="text-sm text-gray-500 mb-6">
        登記您自己的 AI API Key，啟用文件自動解析等智慧功能。
      </p>
      <AiConfigForm />
    </div>
  )
}
