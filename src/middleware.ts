import { withAuth } from 'next-auth/middleware'

// 只保護 (main) 群組的登入狀態
// admin 路徑的 email 權限檢查在 admin/layout.tsx（Server Component）處理，
// 以避免 Vercel Edge Runtime 解密 JWT 的問題
export default withAuth({
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized: ({ token }) => !!token,
  },
})

export const config = {
  matcher: [
    // 保護主系統路徑（排除登入頁、API、靜態資源）
    '/((?!login|api|_next/static|_next/image|favicon\\.ico|admin).*)',
  ],
}
