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

  const needName = await prisma.pRD_Product.count({
    where: {
      isActive: true,
      specification: { not: null },
      name: '未命名商品',
    },
  })

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

  // 取樣前 5 筆需要補的
  const samples = await prisma.pRD_Product.findMany({
    where: {
      isActive: true,
      specification: { not: null },
      OR: [{ name: '未命名商品' }, { htsCode: null }],
    },
    select: { id: true, sku: true, name: true, htsCode: true, specification: true },
    orderBy: { id: 'asc' },
    take: 5,
  })

  return NextResponse.json({
    total,
    needName,
    needHts,
    noSpec,
    actionNeeded: needName + needHts,
    samples: samples.map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      htsCode: p.htsCode,
      specPreview: p.specification?.substring(0, 60),
    })),
    howTo: 'POST /api/admin/re-enrich?batch=5 to start enriching',
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

  // 只抓有 spec、且缺名稱或缺 HS Code 的（除非 force）
  const where = force
    ? { isActive: true }
    : {
        isActive: true,
        AND: [
          { specification: { not: null } },
          {
            OR: [
              { name: '未命名商品' },
              { htsCode: null },
            ],
          },
        ],
      }

  const products = await prisma.pRD_Product.findMany({
    where,
    select: { id: true, name: true, sku: true, modelNo: true, specification: true, htsCode: true },
    orderBy: { id: 'asc' },
    take: batch,
    skip: offset,
  })

  const totalNeed = await prisma.pRD_Product.count({ where })
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
