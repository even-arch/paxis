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
        email:    { label: 'Email',    type: 'email' },
        password: { label: '密碼',     type: 'password' },
        orgSlug:  { label: '公司代碼', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password || !credentials?.orgSlug) return null
        try {
          const org = await masterPrisma.oRG.findUnique({
            where: { slug: credentials.orgSlug },
            select: { slug: true, databaseUrl: true, status: true },
          })
          if (!org || org.status !== 'active' || !org.databaseUrl) return null

          const db = getOrgPrisma(org.databaseUrl, org.slug) as typeof prisma
          const user = await db.sYS_User.findUnique({
            where: { loginId: credentials.email.toLowerCase() },
          })
          if (!user || !user.isEnabled || !user.password) return null
          const ok = await bcrypt.compare(credentials.password, user.password)
          if (!ok) return null
          return {
            id:      user.id.toString(),
            email:   user.loginId,
            name:    user.name ?? user.loginId,
            orgSlug: org.slug,
          }
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
