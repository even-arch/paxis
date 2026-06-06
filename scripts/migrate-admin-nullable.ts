import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.ADMIN_DATABASE_URL!)

async function main() {
  await sql`ALTER TABLE tenants ALTER COLUMN password DROP NOT NULL`
  await sql`ALTER TABLE tenants ALTER COLUMN "dbUrl" DROP NOT NULL`
  console.log('✅ tenants 欄位更新完成（password, dbUrl 可為空）')
}

main().catch(console.error)
