import { neon } from '@neondatabase/serverless'

async function main() {
  // 從 tenant DB 取 Patisco config
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) { console.log('No DATABASE_URL'); return }

  const sql = neon(dbUrl)
  const rows = await sql`SELECT "mcpUrl", "apiKey", "encryptedJwt", "jwtExpiresAt" FROM "SYS_PatiscoConfig" WHERE "isActive" = true LIMIT 1`
  const config = rows[0] as any
  if (!config) { console.log('No Patisco config in DB'); return }

  console.log('mcpUrl:', config.mcpUrl)
  console.log('apiKey:', config.apiKey ? config.apiKey.slice(0,10)+'...' : 'null')
  console.log('jwtExpiresAt:', config.jwtExpiresAt)

  // 試打 MCP listTools（需要 JWT）
  // 先試不帶認證看能不能拿到 tool list
  const res = await fetch(config.mcpUrl ?? 'https://mcp.patisco.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': config.apiKey ?? '',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
  })
  const data = await res.json() as any
  console.log('\ntools/list status:', res.status)
  const tools = data?.result?.tools ?? []
  if (tools.length > 0) {
    console.log(`\n${tools.length} tools:`)
    tools.forEach((t: any) => console.log(` - ${t.name}: ${t.description ?? ''}`.slice(0, 100)))
  } else {
    console.log(JSON.stringify(data, null, 2).slice(0, 300))
  }
}
main().catch(console.error)
