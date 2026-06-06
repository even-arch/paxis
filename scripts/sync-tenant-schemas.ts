/**
 * 同步所有租戶 DB 的 schema，確保與主 DB（#1 even@xinosys.com）一致
 * 只做 ADD COLUMN（不刪欄位、不改型別），安全執行
 *
 * 執行：node --env-file=.env --input-type=module scripts/sync-tenant-schemas.ts
 */
import { neon } from '@neondatabase/serverless'

const adminSql = neon(process.env.ADMIN_DATABASE_URL!)

async function getColumns(dbUrl: string) {
  const sql = neon(dbUrl)
  const rows = await sql`
    SELECT table_name, column_name, data_type, is_nullable, column_default, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `
  return rows as { table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null; character_maximum_length: number | null }[]
}

function pgType(col: { data_type: string; is_nullable: string; column_default: string | null; character_maximum_length: number | null }): string {
  let t = col.data_type.toUpperCase()
  if (t === 'CHARACTER VARYING') t = col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : 'TEXT'
  if (t === 'TIMESTAMP WITH TIME ZONE') t = 'TIMESTAMPTZ'
  if (t === 'TIMESTAMP WITHOUT TIME ZONE') t = 'TIMESTAMP'
  const nullable = col.is_nullable === 'YES'
  const def = col.column_default ? ` DEFAULT ${col.column_default}` : ''
  const nullStr = nullable ? '' : (def ? ' NOT NULL' : '')
  return `${t}${nullStr}${def}`
}

async function main() {
  const tenants = await adminSql`
    SELECT id, email, "dbUrl" FROM tenants
    WHERE status = 'ACTIVE' AND "dbUrl" IS NOT NULL AND "dbUrl" != ''
    ORDER BY id
  ` as { id: number; email: string; dbUrl: string }[]

  if (tenants.length < 2) {
    console.log('租戶數量不足，無需同步')
    return
  }

  // 以 #1 為基準
  const master = tenants[0]
  console.log(`▶ 基準 DB：#${master.id} ${master.email}`)
  const masterCols = await getColumns(master.dbUrl)
  const masterMap = new Map(masterCols.map(c => [`${c.table_name}.${c.column_name}`, c]))

  for (const tenant of tenants.slice(1)) {
    console.log(`\n── 檢查 #${tenant.id} ${tenant.email} ──`)
    const tenantCols = await getColumns(tenant.dbUrl)
    const tenantSet = new Set(tenantCols.map(c => `${c.table_name}.${c.column_name}`))
    const sql = neon(tenant.dbUrl)
    let fixed = 0

    for (const [key, col] of Array.from(masterMap)) {
      if (!tenantSet.has(key)) {
        const [table, column] = key.split('.')
        const typeStr = pgType(col)
        try {
          await sql.unsafe(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${typeStr}`)
          console.log(`  ✓ 補齊 ${key} (${typeStr})`)
          fixed++
        } catch (e: any) {
          console.log(`  ✗ 失敗 ${key}: ${e.message}`)
        }
      }
    }

    if (fixed === 0) console.log('  ✓ 已是最新，無需更新')
    else console.log(`  → 共補齊 ${fixed} 個欄位`)
  }

  console.log('\n✅ 完成')
}

main().catch(e => { console.error(e); process.exit(1) })
