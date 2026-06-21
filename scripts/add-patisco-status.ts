import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "PO"      ADD COLUMN IF NOT EXISTS "patiscoStatus" TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PI_SupplierCopy" ADD COLUMN IF NOT EXISTS "patiscoStatus" TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PO_CustomerCopy"     ADD COLUMN IF NOT EXISTS "patiscoStatus" TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PI"        ADD COLUMN IF NOT EXISTS "patiscoStatus" TEXT`)
  console.log('✓ patiscoStatus 欄位已加入四個表')
}
main().catch(console.error).finally(() => prisma.$disconnect())
