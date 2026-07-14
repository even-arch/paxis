import { cache } from 'react'
import { notFound } from 'next/navigation'
import { prisma } from './db'
import { masterPrisma } from './master-db'
import { getOrgPrisma } from './org-db'

/**
 * Server Component 頁面用的 tenant-aware Prisma。
 * App Router 的 page/layout 不能直接重用 API route 的 getRequestPrisma，
 * 因為它們沒有從 session 推導 orgSlug，而是要以路由參數為準。
 *
 * Fail-closed：slug 查不到就 404，絕不 fallback 到預設 DB
 * （那是 pointasia 的正式資料庫，fallback 等於跨租戶洩漏）。
 * 註：middleware 已強制 URL orgSlug 必須等於 session orgSlug。
 */
export const getPagePrisma = cache(async (orgSlug: string) => {
  if (!orgSlug) notFound()

  const org = await masterPrisma.oRG.findUnique({
    where: { slug: orgSlug },
    select: { databaseUrl: true, status: true },
  })

  if (!org || org.status !== 'active' || !org.databaseUrl) notFound()

  return getOrgPrisma(org.databaseUrl, orgSlug) as typeof prisma
})
