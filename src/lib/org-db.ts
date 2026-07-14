import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

// Cache key 含 databaseUrl：同一 slug 若重新開通（換了 Neon project），
// warm instance 不會繼續用舊連線打到已刪除的 DB
const clientCache = new Map<string, PrismaClient>()

export function getOrgPrisma(databaseUrl: string, orgSlug: string): PrismaClient {
  const key = `${orgSlug}|${databaseUrl}`
  if (clientCache.has(key)) return clientCache.get(key)!

  const adapter = new PrismaNeon({ connectionString: databaseUrl })
  const client = new PrismaClient({ adapter })
  clientCache.set(key, client)
  return client
}
