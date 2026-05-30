import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './db'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        loginId: { label: '帳號', type: 'text' },
        password: { label: '密碼', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.loginId || !credentials?.password) return null

          const user = await prisma.sYS_User.findUnique({
            where: { loginId: credentials.loginId },
          })

          if (!user || !user.isEnabled) return null

          const valid = await bcrypt.compare(credentials.password, user.password)
          if (!valid) return null

          return { id: user.id.toString(), name: user.name, email: user.loginId }
        } catch (e) {
          console.error('[auth] authorize error:', e)
          return null
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string
      return session
    },
  },
}
