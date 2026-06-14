'use client'

import { useRouter } from 'next/navigation'

export default function AdminLogout() {
  const router = useRouter()
  async function logout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }
  return (
    <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600">
      登出
    </button>
  )
}
