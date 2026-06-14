import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

// Cache: orgSlug → PrismaClient
const clientCache = new Map<string, PrismaClient>()

export function getOrgPrisma(databaseUrl: string, orgSlug: string): PrismaClient {
  if (clientCache.has(orgSlug)) return clientCache.get(orgSlug)!

  const adapter = new PrismaNeon({ connectionString: databaseUrl })
  const client = new PrismaClient({ adapter })
  clientCache.set(orgSlug, client)
  return client
}
