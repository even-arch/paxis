import { cache } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './db'
import { masterPrisma } from './master-db'
import { getOrgPrisma } from './org-db'

/**
 * 給無 session 的 API（忘記密碼 / 重設密碼）用：
 * 直接從 orgSlug 查 master DB，回傳對應的 tenant prisma。
 * 若 orgSlug 為空或找不到，回傳 global prisma（向後相容）。
 */
export async function getPrismaByOrgSlug(orgSlug: string | undefined | null) {
  if (!orgSlug) return prisma
  const org = await masterPrisma.oRG.findUnique({
    where: { slug: orgSlug },
    select: { databaseUrl: true, status: true },
  })
  if (!org || org.status !== 'active' || !org.databaseUrl) return prisma
  return getOrgPrisma(org.databaseUrl, orgSlug) as typeof prisma
}

/**
 * 從 session 取得對應 org 的 Prisma client。
 * 每個 request 只查一次 master DB（React cache 去重）。
 * API route 裡：const prisma = await getRequestPrisma()
 */
export const getRequestPrisma = cache(async () => {
  const session = await getServerSession(authOptions)
  const orgSlug = session?.user?.orgSlug as string | undefined

  if (!orgSlug) return prisma // fallback：未登入或舊路由，走預設 DB

  const org = await masterPrisma.oRG.findUnique({
    where: { slug: orgSlug },
    select: { databaseUrl: true, status: true },
  })

  if (!org || org.status !== 'active' || !org.databaseUrl) return prisma

  return getOrgPrisma(org.databaseUrl, orgSlug) as typeof prisma
})
