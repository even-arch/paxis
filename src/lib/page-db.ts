import { cache } from 'react'
import { prisma } from './db'
import { masterPrisma } from './master-db'
import { getOrgPrisma } from './org-db'

/**
 * Server Component 頁面用的 tenant-aware Prisma。
 * App Router 的 page/layout 不能直接重用 API route 的 getRequestPrisma，
 * 因為它們沒有從 session 推導 orgSlug，而是要以路由參數為準。
 */
export const getPagePrisma = cache(async (orgSlug: string) => {
  if (!orgSlug) return prisma

  const org = await masterPrisma.oRG.findUnique({
    where: { slug: orgSlug },
    select: { databaseUrl: true, status: true },
  })

  if (!org || org.status !== 'active' || !org.databaseUrl) return prisma

  return getOrgPrisma(org.databaseUrl, orgSlug) as typeof prisma
})
