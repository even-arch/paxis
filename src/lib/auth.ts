import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './db'
import { masterPrisma } from './master-db'
import { getOrgPrisma } from './org-db'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error:  '/login',
  },
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Email / 密碼',
      credentials: {
        email:    { label: 'Email', type: 'email' },
        password: { label: '密碼',  type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        try {
          // 取得所有 active org，逐一查詢哪個 org 有這個 email
          const orgs = await masterPrisma.oRG.findMany({
            where: { status: 'active' },
            select: { slug: true, databaseUrl: true },
          })

          for (const org of orgs) {
            if (!org.databaseUrl) continue
            try {
              const db = getOrgPrisma(org.databaseUrl, org.slug) as typeof prisma
              const user = await db.sYS_User.findUnique({
                where: { loginId: credentials.email.toLowerCase() },
              })
              if (!user || !user.isEnabled || !user.password) continue
              const ok = await bcrypt.compare(credentials.password, user.password)
              if (!ok) continue
              return {
                id:      user.id.toString(),
                email:   user.loginId,
                name:    user.name ?? user.loginId,
                orgSlug: org.slug,
              }
            } catch {
              // 這個 org DB 暫時無法連線，跳過
              continue
            }
          }
          return null
        } catch (e) {
          console.error('[auth] credentials error:', e)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id      = user.id
        token.email   = user.email ?? ''
        token.orgSlug = (user as { orgSlug?: string }).orgSlug ?? ''
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id      = token.id as string
        session.user.email   = token.email as string
        session.user.orgSlug = token.orgSlug as string
      }
      return session
    },
  },
}
