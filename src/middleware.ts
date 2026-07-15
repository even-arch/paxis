import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequestWithAuth } from 'next-auth/middleware'

// 頂層保留路徑（不是 orgSlug）：
// - PUBLIC：未登入也能開
// - PASSTHROUGH：需要登入，但頁面自己會依 session 處理 org 轉址
const PUBLIC_PATHS = new Set(['login', 'signup', 'forgot-password', 'reset-password'])
const PASSTHROUGH_PATHS = new Set(['dashboard', 'print'])

// 保護 [orgSlug]/(main) 下的所有路由
// login、invite、admin、api、靜態資源不受保護
export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const first = req.nextUrl.pathname.split('/')[1]
    const tokenOrg = req.nextauth.token?.orgSlug as string | undefined

    // 登入者連到別家 org 的路徑 → 帶回自己 org 的首頁（不做跨租戶瀏覽）
    if (
      tokenOrg &&
      first !== tokenOrg &&
      !PUBLIC_PATHS.has(first) &&
      !PASSTHROUGH_PATHS.has(first) &&
      !req.nextUrl.pathname.match(/^\/[^/]+\/login/)
    ) {
      return NextResponse.redirect(new URL(`/${tokenOrg}/dashboard`, req.url))
    }
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
        // /[orgSlug]/login 與頂層公開頁不需要 token
        if (pathname.match(/^\/[^/]+\/login/)) return true
        const first = pathname.split('/')[1]
        if (PUBLIC_PATHS.has(first)) return true
        // 其餘一律要有 token 且 token 必須帶 orgSlug
        //（舊 JWT 沒有 orgSlug → 強制重新登入；org 不符由上方 middleware 轉址）
        return !!token && !!(token as { orgSlug?: string }).orgSlug
      },
    },
  }
)

export const config = {
  matcher: [
    // 保護所有 orgSlug 下的路徑（排除 login、invite、admin、api、靜態資源）
    // fonts = public/fonts（PDF 附件的中文字型由本站 URL 載入，不得要求登入）
    '/:orgSlug((?!admin|invite|api|_next|favicon|fonts)[^/]+)/:path*',
  ],
}
