/**
 * Admin DB Migration：新增 UPS 設定欄位 + system_settings 表
 *
 * 執行：npx ts-node -P tsconfig.scripts.json scripts/migrate-admin-settings.ts
 */
import { neon } from '@neondatabase/serverless'

async function main() {
  const sql = neon(process.env.ADMIN_DATABASE_URL!)

  console.log('▶ 執行 Admin DB migration...')

  // 1. tenants 表加 UPS 欄位
  await sql`
    ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS "upsMode"      TEXT NOT NULL DEFAULT 'managed',
    ADD COLUMN IF NOT EXISTS "upsAccountNo" TEXT
  `
  console.log('✓ tenants: 加入 upsMode, upsAccountNo')

  // 2. 建立 system_settings 表（全局設定，key-value）
  await sql`
    CREATE TABLE IF NOT EXISTS system_settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  console.log('✓ system_settings 表已建立')

  // 3. 寫入預設值
  // PayUni 預設從 env var 抓（Admin 可覆寫）
  // allow_tenant_delete 預設 false
  await sql`
    INSERT INTO system_settings (key, value, "updatedAt")
    VALUES ('allow_tenant_delete', 'false', NOW())
    ON CONFLICT (key) DO NOTHING
  `
  console.log('✓ 預設 allow_tenant_delete = false')

  console.log('\n✅ Migration 完成')
}

main().catch(e => { console.error(e); process.exit(1) })
