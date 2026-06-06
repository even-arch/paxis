/**
 * 重新跑 AI enrichment：更新所有商品的名稱和 HS Code
 * npx ts-node --esm scripts/re-enrich-products.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import { enrichProduct } from '../src/api/patisco/product-enrich'

neonConfig.webSocketConstructor = ws

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  const products = await prisma.pRD_Product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, sku: true, specification: true, htsCode: true },
    orderBy: { id: 'asc' },
  })

  console.log(`Found ${products.length} products to re-enrich\n`)

  const systemUser = await prisma.sYS_User.findFirst({ orderBy: { id: 'asc' } })
  const systemUserId = systemUser?.id ?? 1

  let updated = 0
  for (const p of products) {
    if (!p.specification) {
      console.log(`[skip] #${p.id} ${p.sku} — no specification`)
      continue
    }
    console.log(`[enrich] #${p.id} ${p.sku} (${p.name}) ...`)
    try {
      const changed = await enrichProduct(prisma, p.id, {
        sku: p.sku,
        specification: p.specification,
        systemUserId,
      }, true /* force */)
      if (changed) {
        const after = await prisma.pRD_Product.findUnique({
          where: { id: p.id },
          select: { name: true, htsCode: true },
        })
        console.log(`  → name: "${p.name}" → "${after?.name}"  hts: ${p.htsCode} → ${after?.htsCode}`)
        updated++
      } else {
        console.log(`  → no change`)
      }
    } catch (e) {
      console.error(`  → error: ${e}`)
    }
    // 避免 API rate limit
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\nDone. ${updated}/${products.length} updated.`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
