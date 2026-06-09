import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export interface ApplyProductsInput {
  items: {
    name: string
    specification: string | null
    sku: string | null
    qty: number
    unitPrice: number
    unit: string
    countryOfOrigin?: string | null
    htsCode?: string | null
    /** 使用者在精靈選擇的動作：use-existing = 沿用衝突的現有產品；create = 新建 */
    action?: 'create' | 'use-existing'
    /** 當 action=use-existing 時，指向要沿用的 DB product id */
    conflictId?: number | null
  }[]
  supplierId?: number | null
}

export interface AppliedProduct {
  productId: number
  productName: string
  sku: string | null
  specification: string | null
  productCreated: boolean
  qty: number
  unitPrice: number
  unit: string
}

export async function POST(req: NextRequest) {
    try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { items, supplierId } = await req.json() as ApplyProductsInput

    const result: AppliedProduct[] = []
    const usedSkusThisBatch = new Set<string>()

    for (const pi of items ?? []) {
      if (!pi || (!pi.name && !pi.sku)) continue

      const sku = pi.sku?.trim() || null
      const specification = pi.specification?.trim() || null
      const rawName = pi.name?.trim() || null
      // 偵測 name 是否為型號：無空格、含數字或連字符的英數字串（如 S52RB、BL-M315）
      // 純字母單字（如 CHAIN、Pedal、Lever）不算型號
      const looksLikeModelNo = (s: string) =>
        !s.includes(' ') &&
        /^[A-Z0-9][A-Z0-9\-\+\.\/]*$/i.test(s) &&
        (/\d/.test(s) || /[-+.]/.test(s))
      const nameIsModelNo = rawName && (
        (sku && rawName.toLowerCase() === sku.toLowerCase()) ||
        looksLikeModelNo(rawName)
      )
      // fallback：AI 填了型號時，用 specification 前段當暫代（僅作保險，正確答案應來自 AI）
      const nameFromSpec = specification
        ? specification.replace(/[\d\-\+\.\/,，]+$/, '').slice(0, 30).trim()
        : null
      const name = (!rawName || nameIsModelNo) ? (nameFromSpec || rawName || '未命名商品') : rawName
      const unit = pi.unit?.trim() || 'PCS'
      const countryOfOrigin = pi.countryOfOrigin?.trim() || null
      const htsCode = pi.htsCode?.trim() || null

      let product = null
      let productCreated = false

      // ── 若使用者明確選擇「沿用現有產品」，直接查 DB 該 id ─────────────────
      if (pi.action === 'use-existing' && pi.conflictId) {
        product = await prisma.pRD_Product.findUnique({ where: { id: pi.conflictId } })
        if (product) {
          if (product.sku) usedSkusThisBatch.add(product.sku.toLowerCase())
          if (supplierId) {
            await prisma.sUP_SupplierProduct.upsert({
              where: { supplierId_productId: { supplierId, productId: product.id } },
              create: { supplierId, productId: product.id, isPreferred: true },
              update: {},
            }).catch(() => {})
          }
          result.push({
            productId: product.id, productName: product.name, sku: product.sku,
            specification: product.specification ?? null, productCreated: false,
            qty: pi.qty ?? 1, unitPrice: pi.unitPrice ?? 0, unit,
          })
          continue
        }
      }

      // 同批次中已用過的 SKU 不做比對（避免多品項誤判為同一商品）
      const effectiveSku = sku && !usedSkusThisBatch.has(sku.toLowerCase()) ? sku : null

      // 1. SKU 比對（優先）
      if (effectiveSku) {
        product = await prisma.pRD_Product.findFirst({
          where: { sku: { equals: effectiveSku, mode: 'insensitive' } },
        })
      }

      // 2. 規格說明精確比對（SKU 缺失時的備用方案）
      if (!product && !effectiveSku && specification) {
        product = await prisma.pRD_Product.findFirst({
          where: { specification: { equals: specification, mode: 'insensitive' } },
        })
      }

      if (!product) {
        let finalSku = effectiveSku
        if (finalSku) {
          const existing = await prisma.pRD_Product.findUnique({ where: { sku: finalSku } })
          if (existing) finalSku = null
        }

        product = await prisma.pRD_Product.create({
          data: { name, sku: finalSku, specification, unit, countryOfOrigin, htsCode },
        })
        productCreated = true
      }

      if (product.sku) usedSkusThisBatch.add(product.sku.toLowerCase())

      // 若文件提供了 htsCode 且產品目前還沒有，順便填入
      if (htsCode && !product.htsCode) {
        await prisma.pRD_Product.update({ where: { id: product.id }, data: { htsCode } }).catch(() => {})
      }

      if (supplierId) {
        await prisma.sUP_SupplierProduct.upsert({
          where: { supplierId_productId: { supplierId, productId: product.id } },
          create: { supplierId, productId: product.id, isPreferred: true },
          update: {},
        }).catch(() => {})
      }

      result.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        specification: product.specification ?? null,
        productCreated,
        qty: pi.qty ?? 1,
        unitPrice: pi.unitPrice ?? 0,
        unit,
      })
    }

    return NextResponse.json({ ok: true, data: result })
  } catch (err) {
    console.error('[POST /api/ai/apply-products]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
