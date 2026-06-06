import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'even@xinosys.com'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const email = req.nextauth.token?.email as string | undefined

    // /admin 路徑只有管理員可進
    if (pathname.startsWith('/admin') && email !== ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return NextResponse.next()
  },
  {
    callbacks: {
      // token 存在才繼續（否則 withAuth 會自動導向 /login）
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: ['/admin/:path*'],
}
