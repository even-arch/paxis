import { cache } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './db'
import { masterPrisma } from './master-db'
import { getOrgPrisma } from './org-db'

/**
 * 給無 session 的 API（忘記密碼 / 重設密碼）用：
 * 直接從 orgSlug 查 master DB，回傳對應的 tenant prisma。
 *
 * Fail-closed：orgSlug 缺失或查不到一律 throw，
 * 絕不 fallback 到預設 DB（那是 pointasia 的正式資料庫）。
 */
export async function getPrismaByOrgSlug(orgSlug: string | undefined | null) {
  if (!orgSlug) throw new Error('缺少公司代碼（orgSlug）')
  const org = await masterPrisma.oRG.findUnique({
    where: { slug: orgSlug },
    select: { databaseUrl: true, status: true },
  })
  if (!org || org.status !== 'active' || !org.databaseUrl) {
    throw new Error(`找不到租戶或未啟用：${orgSlug}`)
  }
  return getOrgPrisma(org.databaseUrl, orgSlug) as typeof prisma
}

/**
 * 從 session 取得對應 org 的 Prisma client。
 * 每個 request 只查一次 master DB（React cache 去重）。
 * API route 裡：const prisma = await getRequestPrisma()
 *
 * Fail-closed：已登入但 session 缺 orgSlug（舊 JWT）、或 org 查不到，
 * 一律 throw，絕不默默 fallback 到預設 DB 造成跨租戶讀寫。
 * 未登入時回傳預設 prisma —— route 隨後的 session 檢查會回 401，不會用到它。
 */
export const getRequestPrisma = cache(async () => {
  const session = await getServerSession(authOptions)
  if (!session) return prisma // 未登入：route 會直接 401

  const orgSlug = session.user?.orgSlug as string | undefined
  if (!orgSlug) {
    throw new Error('Session 缺少公司代碼，請重新登入')
  }

  const org = await masterPrisma.oRG.findUnique({
    where: { slug: orgSlug },
    select: { databaseUrl: true, status: true },
  })

  if (!org || org.status !== 'active' || !org.databaseUrl) {
    throw new Error(`找不到租戶或未啟用：${orgSlug}`)
  }

  return getOrgPrisma(org.databaseUrl, orgSlug) as typeof prisma
})
