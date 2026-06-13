import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "CUS_Customer" ADD COLUMN IF NOT EXISTS "shippingMarkTemplate" TEXT`)
  console.log('done')
}
main().catch(console.error).finally(() => prisma.$disconnect())
