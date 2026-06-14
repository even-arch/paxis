import { readFileSync } from 'fs'
import { join } from 'path'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

// Required for using Pool in Node.js runtime (not Edge)
neonConfig.webSocketConstructor = ws

const NEON_API = 'https://console.neon.tech/api/v2'

interface NeonProject {
  id: string
}

async function createNeonProject(slug: string): Promise<{ projectId: string; connectionString: string }> {
  const apiKey = process.env.NEON_API_KEY
  if (!apiKey) throw new Error('未設定 NEON_API_KEY')

  const orgId = process.env.NEON_ORG_ID ?? 'org-restless-fire-71730690'
  const reqBody = {
    org_id: orgId,
    project: {
      name: `paxis-${slug}`,
      region_id: 'aws-ap-southeast-1',
      pg_version: 16,
    },
  }
  console.log('[neon] creating project, org_id:', orgId, 'body:', JSON.stringify(reqBody))

  const res = await fetch(`${NEON_API}/projects`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(reqBody),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Neon API 錯誤 ${res.status}: ${text}`)
  }

  const data = await res.json() as { project: NeonProject; connection_uris: { connection_uri: string }[] }
  const connectionString = data.connection_uris?.[0]?.connection_uri
  if (!connectionString) throw new Error('Neon 未回傳 connection URI')

  return { projectId: data.project.id, connectionString }
}

async function runSchema(connectionString: string) {
  const schemaPath = join(process.cwd(), 'prisma', 'tenant-schema.sql')
  const sql = readFileSync(schemaPath, 'utf-8')

  // Split on statement boundaries and execute
  const pool = new Pool({ connectionString })
  try {
    await pool.query(sql)
  } finally {
    await pool.end()
  }
}

/** Creates a new Neon project for the given org slug, runs tenant-schema.sql, and returns the connection string */
export async function provisionOrgDatabase(slug: string): Promise<string> {
  const { connectionString } = await createNeonProject(slug)
  await runSchema(connectionString)
  return connectionString
}
