import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 保護 [orgSlug]/(main) 下的所有路由
// login、invite、admin、api、靜態資源不受保護
export default withAuth(
  function middleware(_req: NextRequest) {
    return NextResponse.next()
  },
  {
    pages: {
      // 登入頁依 orgSlug 動態決定，由 layout redirect 處理
      signIn: '/login',
    },
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        // /[orgSlug]/login 不需要 token
        if (pathname.match(/^\/[^/]+\/login/)) return true
        if (!token) return false
        // token 必須帶 orgSlug，且要跟 URL 的 orgSlug 一致
        // （舊 JWT 沒有 orgSlug → 強制重新登入；跨 org 瀏覽 → 擋下）
        const urlOrg = pathname.split('/')[1]
        const tokenOrg = (token as { orgSlug?: string }).orgSlug
        return !!tokenOrg && tokenOrg === urlOrg
      },
    },
  }
)

export const config = {
  matcher: [
    // 保護所有 orgSlug 下的路徑（排除 login、invite、admin、api、靜態資源）
    '/:orgSlug((?!admin|invite|api|_next|favicon)[^/]+)/:path*',
  ],
}
