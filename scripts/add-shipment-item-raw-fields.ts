/**
 * SLS_ShipmentItem 加入 rawSku / rawProductName 欄位
 * 讓 Patisco 出貨明細即使 SKU 不在 PRD_Product 也不丟資料
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "SLS_ShipmentItem" ADD COLUMN IF NOT EXISTS "rawSku" TEXT`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "SLS_ShipmentItem" ADD COLUMN IF NOT EXISTS "rawProductName" TEXT`
  )
  console.log('✓ SLS_ShipmentItem rawSku / rawProductName 欄位已加入')
}

main().catch(console.error).finally(() => prisma.$disconnect())
