import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './db'

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
          const user = await prisma.sYS_User.findUnique({
            where: { loginId: credentials.email.toLowerCase() },
          })
          if (!user || !user.isEnabled || !user.password) return null
          const ok = await bcrypt.compare(credentials.password, user.password)
          if (!ok) return null
          return {
            id:    user.id.toString(),
            email: user.loginId,
            name:  user.name ?? user.loginId,
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
        token.id    = user.id
        token.email = user.email ?? ''
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id    = token.id as string
        session.user.email = token.email as string  // 明確帶出 email，admin 授權需要
      }
      return session
    },
  },
}
