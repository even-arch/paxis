import { prisma } from '@/lib/db'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  const company = await prisma.sYS_Company.findFirst({ where: { id: 1 } })
  const displayName = company?.shortName || company?.nameEn || company?.nameZh || 'PAXIS'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        {/* 公司識別 */}
        <div className="flex flex-col items-center mb-8">
          {company?.logoBase64 ? (
            <img
              src={company.logoBase64}
              alt={displayName}
              className="h-14 object-contain mb-3"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center mb-3">
              <span className="text-white font-bold text-xl">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-800">{displayName}</h1>
          {company?.nameZh && company.nameZh !== displayName && (
            <p className="text-sm text-gray-400 mt-0.5">{company.nameZh}</p>
          )}
        </div>

        <LoginForm />
      </div>
    </div>
  )
}
