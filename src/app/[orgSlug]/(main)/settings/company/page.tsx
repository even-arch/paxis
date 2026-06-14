import CompanyForm from './CompanyForm'

export default function CompanySettingsPage() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">公司基本資料</h1>
      <p className="text-sm text-gray-500 mb-6">
        此資料會自動帶入所有列印文件的抬頭，請確保英文名稱與地址正確。
      </p>
      <CompanyForm />
    </div>
  )
}
