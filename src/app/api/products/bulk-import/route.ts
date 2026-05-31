import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { ParsedInvoice } from '@/app/api/ai/parse-invoice/route'

interface ImportItem {
  item: ParsedInvoice['items'][0]
  // 'create' = 新建（無衝突）
  // 'update' = 沿用新資料並寫歷史
  // 'keep'   = 保留現有資料，僅記錄歷史
  // 'skip'   = 略過
  action: 'create' | 'update' | 'keep' | 'skip'
  existingId?: number // 衝突時的現有產品 ID
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = parseInt((session.user as { id?: string })?.id ?? '', 10)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { items: ImportItem[] }
    const results = []

    for (const { item, action, existingId } of body.items ?? []) {
      if (!item || (!item.name && !item.sku)) continue
      if (action === 'skip') {
        results.push({ name: item.name ?? item.sku, sku: item.sku, action: 'skip', reason: '使用者略過' })
        continue
      }

      const sku = item.sku?.trim() || null
      const name = (item.name?.trim() || sku || '未命名商品')
      const specification = item.specification?.trim() || null
      const unit = item.unit?.trim() || 'PCS'
      const countryOfOrigin = item.countryOfOrigin?.trim() || null

      if (action === 'create') {
        // 雙重保護：確認沒有衝突
        const conflict = sku
          ? await prisma.pRD_Product.findUnique({ where: { sku } })
          : await prisma.pRD_Product.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } })

        if (conflict) {
          results.push({ name, sku, action: 'skip', reason: 'SKU 或品名已存在（未宣告衝突決策）' })
          continue
        }

        const product = await prisma.pRD_Product.create({
          data: { name, sku, specification, unit, countryOfOrigin },
        })

        await prisma.pRD_ProductHistory.create({
          data: {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            unit: product.unit,
            unitCost: item.unitPrice ? String(item.unitPrice) : null,
            sourceType: 'AI_IMPORT',
            changedBy: userId,
          },
        })

        results.push({ name: product.name, sku: product.sku, productId: product.id, action: 'created' })

      } else if ((action === 'update' || action === 'keep') && existingId) {
        const existing = await prisma.pRD_Product.findUnique({ where: { id: existingId } })
        if (!existing) {
          results.push({ name, sku, action: 'skip', reason: '找不到既有產品' })
          continue
        }

        if (action === 'update') {
          await prisma.pRD_Product.update({
            where: { id: existingId },
            data: {
              name,
              ...(sku ? { sku } : {}),
              ...(specification ? { specification } : {}),
              unit: unit || existing.unit,
              ...(countryOfOrigin ? { countryOfOrigin } : {}),
            },
          })
        }

        // 不論 update / keep，都記錄一筆歷史快照
        await prisma.pRD_ProductHistory.create({
          data: {
            productId: existingId,
            name: action === 'update' ? name : existing.name,
            sku: action === 'update' ? sku ?? existing.sku : existing.sku,
            modelNo: existing.modelNo,
            specification: existing.specification,
            unit: existing.unit,
            unitCost: item.unitPrice ? String(item.unitPrice) : null,
            sourceType: 'AI_IMPORT',
            changedBy: userId,
          },
        })

        results.push({
          name: action === 'update' ? name : existing.name,
          sku: action === 'update' ? sku : existing.sku,
          productId: existingId,
          action: action === 'update' ? 'updated' : 'kept',
        })
      }
    }

    return NextResponse.json({ ok: true, results })

  } catch (err) {
    console.error('[POST /api/products/bulk-import]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
