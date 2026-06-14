import { NextRequest, NextResponse } from 'next/server'
import { syncPatiscoPIs, syncPatiscoBuyers, syncPatiscoSellers, syncPatiscoSupplierPOs, processNextPendingDO, seedDOQueue } from '@/api/patisco/sync'
import { patiscoLogin } from '@/api/patisco/client'
import { getRequestPrisma } from '@/lib/request-db'

const DEFAULT_MCP_URL = process.env.PATISCO_MCP_URL ?? 'https://mcp.patisco.com'
async function rawMcpCall(creds: { jwt: string; apiKey: string; _mcpUrl?: string }, tool: string, args: Record<string, unknown>) {
  const base = creds._mcpUrl ?? DEFAULT_MCP_URL
  const res = await fetch(`${base}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${creds.jwt}`, 'X-API-Key': creds.apiKey },
    body: JSON.stringify({ jsonrpc: '2.0', id: 9001, method: 'tools/call', params: { name: tool, arguments: args } }),
    signal: AbortSignal.timeout(30_000),
  })
  return res.json()
}

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()

  try {
    // 檢查 sync 開關：關閉時直接回傳，不執行任何 MCP 呼叫
    const config = await prisma.sYS_PatiscoConfig.findFirst({ where: { isActive: true } })
    if (config && config.syncEnabled === false) {
      return NextResponse.json({
        ok: false,
        skipped: true,
        reason: 'Patisco sync 已暫停（syncEnabled = false）。請至設定 → Patisco 連結開啟。',
        durationMs: Date.now() - start,
      })
    }

    const creds = await patiscoLogin(prisma)
    const dbUrl = process.env.DATABASE_URL!

    // DEBUG MODE: ?raw=1 直接回傳 raw MCP 結果，不跑完整 sync
    const { searchParams } = req.nextUrl
    if (searchParams.get('raw') === '1' && creds) {
      const tool = searchParams.get('tool') ?? 'listOrderCopies'
      const args: Record<string, unknown> = {}
      // 數字欄位自動轉型（Patisco 要求 number，querystring 傳進來是 string）
      const NUM_FIELDS = new Set(['first', 'offset', 'limit', 'page'])
      searchParams.forEach((v, k) => {
        if (k === 'raw' || k === 'tool') return
        args[k] = NUM_FIELDS.has(k) ? Number(v) : v
      })
      const raw = await rawMcpCall(creds, tool, args)
      return NextResponse.json({ tool, args, raw })
    }

    // DO 佇列：每次 cron 只處理 1 筆；佇列空了才 seed（避免每次都打 Patisco 清單 API）
    const pendingCount = await prisma.sYS_PatiscoSync.count({ where: { docType: 'DO', status: 'pending' } })
    if (pendingCount === 0) {
      await seedDOQueue(prisma, creds ?? undefined)
    }
    const doResult = await processNextPendingDO('cron', prisma, dbUrl, creds ?? undefined)

    // sellers/buyers/PI/PO 仍照常跑（這些都很快）
    const sellerResult = await syncPatiscoSellers('cron', prisma, creds ?? undefined)
    const buyerResult  = await syncPatiscoBuyers('cron', prisma, creds ?? undefined)
    const piResult     = await syncPatiscoPIs('cron', prisma, dbUrl, creds ?? undefined)
    const poResult     = await syncPatiscoSupplierPOs('cron', prisma, dbUrl, creds ?? undefined)

    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - start,
      do: doResult,
      sellers: sellerResult,
      buyers: buyerResult,
      pi: piResult,
      po: {
        ...poResult,
        _note: 'getOrderCopyDetail/getOrderCopyProducts 對買方角色 Forbidden/GraphQL bug，商品明細待 Patisco 修復後補入',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/patisco-sync] 失敗:', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
