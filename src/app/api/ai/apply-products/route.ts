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
      const name = pi.name?.trim() || sku || '未命名商品'
      const specification = pi.specification?.trim() || null
      const unit = pi.unit?.trim() || 'PCS'
      const countryOfOrigin = pi.countryOfOrigin?.trim() || null

      let product = null
      let productCreated = false

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
          data: { name, sku: finalSku, specification, unit, countryOfOrigin },
        })
        productCreated = true
      }

      if (product.sku) usedSkusThisBatch.add(product.sku.toLowerCase())

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
