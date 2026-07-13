import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import type { PrismaClient } from '@prisma/client'

type Params = { params: { id: string } }

// ─── 多階展開的樹節點 ───────────────────────────────────────────
export type BomTreeNode = {
  productId: number
  name: string
  sku: string | null
  productType: number
  unit: string | null
  qtyPer: string          // 相對上一層的用量（Decimal 序列化為字串）
  scrapRate: string | null
  preferredSupplier: { id: number; name: string; shortName: string | null } | null
  isCircular: boolean     // 防呆：展開時偵測到循環，標記後不再往下
  children: BomTreeNode[]
}

async function buildTree(
  prisma: PrismaClient,
  productId: number,
  visited: Set<number>,
): Promise<BomTreeNode[]> {
  const header = await prisma.bOM_Header.findFirst({
    where: { productId, isActive: true },
    orderBy: { version: 'desc' },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
        include: {
          component: { select: { id: true, name: true, sku: true, productType: true, unit: true } },
          preferredSupplier: { select: { id: true, name: true, shortName: true } },
        },
      },
    },
  })
  if (!header) return []

  const nodes: BomTreeNode[] = []
  for (const item of header.items) {
    const circular = visited.has(item.componentId)
    const nextVisited = new Set(visited)
    nextVisited.add(item.componentId)
    nodes.push({
      productId: item.componentId,
      name: item.component.name,
      sku: item.component.sku,
      productType: item.component.productType,
      unit: item.unit ?? item.component.unit,
      qtyPer: item.qtyPer.toString(),
      scrapRate: item.scrapRate?.toString() ?? null,
      preferredSupplier: item.preferredSupplier,
      isCircular: circular,
      children: circular
        ? []
        : await buildTree(prisma, item.componentId, nextVisited),
    })
  }
  return nodes
}

// ─── GET：現行 BOM + 多階展開樹 ─────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const productId = Number(params.id)
  if (isNaN(productId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const header = await prisma.bOM_Header.findFirst({
    where: { productId, isActive: true },
    orderBy: { version: 'desc' },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
        include: {
          component: {
            select: {
              id: true, name: true, sku: true, productType: true, unit: true,
              supplierProducts: {
                select: { supplier: { select: { id: true, name: true, shortName: true } }, isPreferred: true },
              },
            },
          },
          preferredSupplier: { select: { id: true, name: true, shortName: true } },
        },
      },
    },
  })

  const tree = await buildTree(prisma, productId, new Set([productId]))

  return NextResponse.json({
    header: header
      ? {
          id: header.id,
          version: header.version,
          note: header.note,
          updatedAt: header.updatedAt,
          items: header.items.map(i => ({
            componentId: i.componentId,
            component: i.component,
            qtyPer: i.qtyPer.toString(),
            unit: i.unit,
            scrapRate: i.scrapRate?.toString() ?? null,
            preferredSupplierId: i.preferredSupplierId,
            preferredSupplier: i.preferredSupplier,
            sortOrder: i.sortOrder,
            note: i.note,
          })),
        }
      : null,
    tree,
  })
}

// ─── 循環檢查：從 componentId 沿 BOM 邊往下走，不得回到 rootId ────
async function reachesProduct(
  prisma: PrismaClient,
  fromProductId: number,
  targetId: number,
): Promise<boolean> {
  const queue = [fromProductId]
  const seen = new Set<number>(queue)
  while (queue.length > 0) {
    const batch = queue.splice(0, queue.length)
    const headers = await prisma.bOM_Header.findMany({
      where: { productId: { in: batch }, isActive: true },
      select: { items: { select: { componentId: true } } },
    })
    for (const h of headers) {
      for (const it of h.items) {
        if (it.componentId === targetId) return true
        if (!seen.has(it.componentId)) {
          seen.add(it.componentId)
          queue.push(it.componentId)
        }
      }
    }
  }
  return false
}

// ─── PUT：整份取代現行 BOM 的零件行 ─────────────────────────────
export async function PUT(req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const productId = Number(params.id)
  if (isNaN(productId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await req.json() as {
    note?: string | null
    items: Array<{
      componentId: number
      qtyPer: string | number
      scrapRate?: string | number | null
      preferredSupplierId?: number | null
      note?: string | null
    }>
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: 'items 必填' }, { status: 400 })
  }

  // 基本驗證
  const seen = new Set<number>()
  for (const item of body.items) {
    if (item.componentId === productId) {
      return NextResponse.json({ error: '零件不能是產品自己' }, { status: 400 })
    }
    if (seen.has(item.componentId)) {
      return NextResponse.json({ error: '同一零件重複出現' }, { status: 400 })
    }
    seen.add(item.componentId)
    const qty = Number(item.qtyPer)
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: '用量必須大於 0' }, { status: 400 })
    }
  }

  // 循環檢查：任一零件的 BOM 鏈往下走不得回到本產品
  for (const item of body.items) {
    if (await reachesProduct(prisma, item.componentId, productId)) {
      return NextResponse.json(
        { error: `循環引用：零件 #${item.componentId} 的 BOM 鏈中包含本產品` },
        { status: 400 },
      )
    }
  }

  const userId = session.user?.id ? parseInt(session.user.id) : null

  const result = await prisma.$transaction(async tx => {
    let header = await tx.bOM_Header.findFirst({
      where: { productId, isActive: true },
      orderBy: { version: 'desc' },
    })
    if (!header) {
      header = await tx.bOM_Header.create({
        data: { productId, version: 1, note: body.note ?? null, createdBy: userId },
      })
    } else if (body.note !== undefined) {
      header = await tx.bOM_Header.update({
        where: { id: header.id },
        data: { note: body.note },
      })
    }

    await tx.bOM_Item.deleteMany({ where: { bomId: header.id } })
    if (body.items.length > 0) {
      await tx.bOM_Item.createMany({
        data: body.items.map((item, idx) => ({
          bomId: header!.id,
          componentId: item.componentId,
          qtyPer: String(item.qtyPer),
          scrapRate: item.scrapRate != null && item.scrapRate !== '' ? String(item.scrapRate) : null,
          preferredSupplierId: item.preferredSupplierId ?? null,
          sortOrder: idx,
          note: item.note ?? null,
        })),
      })
    }
    return header
  })

  return NextResponse.json({ ok: true, headerId: result.id, version: result.version })
}
