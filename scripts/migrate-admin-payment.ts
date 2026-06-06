import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.ADMIN_DATABASE_URL!)

async function main() {
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "tradeNo" TEXT`
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "cardToken" TEXT`
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "nextBillingDate" TIMESTAMPTZ`
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "monthlyFee" INTEGER NOT NULL DEFAULT 1000`
  console.log('✅ tenants 付款欄位新增完成')
}

main().catch(console.error)
