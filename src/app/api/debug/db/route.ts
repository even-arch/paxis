export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export async function GET() {
  const dbUrl = process.env.DATABASE_URL ?? ''
  const host = dbUrl.match(/@([^/]+)\//)?.[1] ?? 'unknown'
  const sql = neon(dbUrl)
  const count = await sql`SELECT count(*) FROM "SYS_PatiscoSync"`.catch(() => [{ count: 'error' }])
  return NextResponse.json({ dbHost: host, syncCount: count[0]?.count })
}
