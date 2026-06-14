import { Suspense } from 'react'
import LoginForm from './LoginForm'

import { redirect } from 'next/navigation'

export default function LoginPage({ params }: { params: { orgSlug: string } }) {
  // PointAsia 的登入統一在 /login，不用 /pointasia/login
  if (params.orgSlug === 'pointasia') redirect('/login')
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center mb-3">
            <span className="text-white font-bold text-xl">P</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">PAXIS</h1>
        </div>
        <Suspense fallback={<div className="h-12" />}>
          <LoginForm orgSlug={params.orgSlug} />
        </Suspense>
      </div>
    </div>
  )
}
