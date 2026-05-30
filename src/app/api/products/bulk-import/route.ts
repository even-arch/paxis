import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { ParsedInvoice } from '@/app/api/ai/parse-invoice/route'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { items } = await req.json() as { items: ParsedInvoice['items'] }

    const results = []

    for (const item of items ?? []) {
      if (!item || (!item.description && !item.sku)) continue

      const sku = item.sku?.trim() || null
      const name = item.description?.trim() || sku || '未命名商品'

      // SKU 唯一性檢查
      if (sku) {
        const existing = await prisma.pRD_Product.findUnique({ where: { sku } })
        if (existing) {
          results.push({ name, sku, created: false, skipped: true, reason: 'SKU 已存在' })
          continue
        }
      }

      // 品名重複檢查
      const sameName = await prisma.pRD_Product.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      })
      if (sameName) {
        results.push({ name, sku, created: false, skipped: true, reason: '品名已存在' })
        continue
      }

      const product = await prisma.pRD_Product.create({
        data: { name, sku, unit: item.unit ?? 'PCS' },
      })

      results.push({ name: product.name, sku: product.sku, productId: product.id, created: true, skipped: false })
    }

    return NextResponse.json({ ok: true, results })

  } catch (err) {
    console.error('[POST /api/products/bulk-import]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
