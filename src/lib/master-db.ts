import { PrismaClient } from '@/generated/master'
import { PrismaNeon } from '@prisma/adapter-neon'

function makeMasterPrisma() {
  const adapter = new PrismaNeon({ connectionString: process.env.MASTER_DATABASE_URL! })
  return new PrismaClient({ adapter })
}

const globalForMaster = globalThis as unknown as { masterPrisma: PrismaClient }

export const masterPrisma = globalForMaster.masterPrisma ?? makeMasterPrisma()

if (process.env.NODE_ENV !== 'production') globalForMaster.masterPrisma = masterPrisma
