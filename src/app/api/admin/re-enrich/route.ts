/**
 * GET  /api/admin/re-enrich              → 預覽：需要補名稱/HS Code 的商品數量
 * POST /api/admin/re-enrich?batch=5      → 跑一批（預設 5 筆，最多 10）
 * POST /api/admin/re-enrich?batch=5&offset=5  → 跑下一批
 * POST /api/admin/re-enrich?force=true   → 強制重跑（覆蓋已有值）
 *
 * 設計：分批跑，避免 Vercel function timeout（每批 ~30s）
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { enrichProduct } from '@/api/patisco/product-enrich'

// ── GET：預覽 ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const total = await prisma.pRD_Product.count({ where: { isActive: true } })

  // name = modelNo 表示首次 sync 時塞的 placeholder，尚未 AI 豐富化
  const needNameResult = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint AS count FROM "PRD_Product"
    WHERE "isActive" = true AND specification IS NOT NULL
    AND "modelNo" IS NOT NULL AND name = "modelNo"
  `
  const needName = Number(needNameResult[0].count)

  const needHts = await prisma.pRD_Product.count({
    where: {
      isActive: true,
      specification: { not: null },
      htsCode: null,
    },
  })

  const noSpec = await prisma.pRD_Product.count({
    where: { isActive: true, specification: null },
  })

  // 取樣前 5 筆需要補的（name = modelNo 或缺 htsCode）
  const samples = await prisma.$queryRaw<{ id: number; sku: string; name: string; htsCode: string | null; specification: string | null }[]>`
    SELECT id, sku, name, "htsCode", specification FROM "PRD_Product"
    WHERE "isActive" = true AND specification IS NOT NULL
    AND ("modelNo" IS NOT NULL AND name = "modelNo" OR "htsCode" IS NULL)
    ORDER BY id ASC LIMIT 5
  `

  // 診斷 AI config 是否可用
  const user = await prisma.sYS_User.findFirst({
    orderBy: { id: 'asc' },
    select: { aiProvider: true, encryptedAiKey: true, aiParseModel: true },
  })
  const aiConfigured = !!(user?.aiProvider && user?.encryptedAiKey)

  return NextResponse.json({
    total,
    needName,
    needHts,
    noSpec,
    actionNeeded: needName + needHts,
    aiConfigured,
    aiProvider: user?.aiProvider ?? null,
    aiModel: user?.aiParseModel ?? null,
    samples: samples.map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      htsCode: p.htsCode,
      specPreview: p.specification?.substring(0, 60),
    })),
    howTo: 'POST /api/admin/re-enrich?batch=5&force=true to force re-enrich all',
  })
}

// ── POST：執行一批 ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const batch  = Math.min(Number(searchParams.get('batch')  ?? '5'), 10)
  const offset = Number(searchParams.get('offset') ?? '0')
  const force  = searchParams.get('force') === 'true'

  type ProductRow = { id: number; name: string; sku: string; modelNo: string | null; specification: string | null; htsCode: string | null }

  // Prisma 不支援跨欄位比較（name = modelNo），故用 raw SQL
  const products: ProductRow[] = force
    ? await prisma.$queryRaw`
        SELECT id, name, sku, "modelNo", specification, "htsCode" FROM "PRD_Product"
        WHERE "isActive" = true
        ORDER BY id ASC LIMIT ${batch} OFFSET ${offset}
      `
    : await prisma.$queryRaw`
        SELECT id, name, sku, "modelNo", specification, "htsCode" FROM "PRD_Product"
        WHERE "isActive" = true AND specification IS NOT NULL
        AND ("modelNo" IS NOT NULL AND name = "modelNo" OR "htsCode" IS NULL)
        ORDER BY id ASC LIMIT ${batch} OFFSET ${offset}
      `

  const totalNeedRows = force
    ? await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*)::bigint AS count FROM "PRD_Product" WHERE "isActive" = true`
    : await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count FROM "PRD_Product"
        WHERE "isActive" = true AND specification IS NOT NULL
        AND ("modelNo" IS NOT NULL AND name = "modelNo" OR "htsCode" IS NULL)
      `
  const totalNeed = Number(totalNeedRows[0].count)
  const systemUser = await prisma.sYS_User.findFirst({ orderBy: { id: 'asc' } })
  const systemUserId = systemUser?.id ?? 1

  const results = []

  for (const p of products) {
    if (!p.specification && !force) {
      results.push({ id: p.id, sku: p.sku, skipped: 'no spec' })
      continue
    }

    const changed = await enrichProduct(
      prisma,
      p.id,
      {
        sku:           p.sku,
        modelNo:       p.modelNo,
        specification: p.specification,
        systemUserId,
      },
      force,
    )

    const after = await prisma.pRD_Product.findUnique({
      where: { id: p.id },
      select: { name: true, htsCode: true },
    })

    results.push({
      id:        p.id,
      sku:       p.sku,
      changed,
      nameBefore:  p.name,
      nameAfter:   after?.name,
      htsBefore:   p.htsCode,
      htsAfter:    after?.htsCode,
    })
  }

  const changed = results.filter(r => r.changed).length

  return NextResponse.json({
    ok: true,
    offset,
    batch,
    processed: results.length,
    changed,
    totalNeed,
    hasMore: offset + batch < totalNeed,
    nextOffset: offset + batch,
    results,
  })
}
