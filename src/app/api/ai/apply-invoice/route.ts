import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { ParsedInvoice } from '@/app/api/ai/parse-invoice/route'

export interface AppliedInvoice {
  supplierId: number | null
  supplierName: string
  supplierCreated: boolean
  currency: string
  invoiceNo: string | null
  invoiceDate: string | null
  notes: string | null
  items: {
    productId: number
    productName: string
    sku: string | null
    productCreated: boolean
    qty: number
    unitPrice: number
    unit: string
  }[]
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = await req.json() as ParsedInvoice

    // ── 1. 處理供應商 ───────────────────────────────────────────
    let supplierId: number | null = null
    let supplierCreated = false
    const supplierName = parsed.supplierName?.trim() ?? ''

    if (supplierName) {
      // 先找完全符合，再找部分符合
      let supplier = await prisma.sUP_Supplier.findFirst({
        where: {
          OR: [
            { name: { equals: supplierName, mode: 'insensitive' } },
            { shortName: { equals: supplierName, mode: 'insensitive' } },
            { name: { contains: supplierName, mode: 'insensitive' } },
          ],
        },
      })

      if (!supplier) {
        supplier = await prisma.sUP_Supplier.create({
          data: {
            name: supplierName,
            shortName: supplierName.length > 20 ? supplierName.slice(0, 20) : null,
            email: parsed.supplierEmail ?? null,
          },
        })
        supplierCreated = true
      }

      supplierId = supplier.id
    }

    // ── 2. 處理每個品項 ─────────────────────────────────────────
    const items: AppliedInvoice['items'] = []

    for (const pi of parsed.items ?? []) {
      if (!pi || (!pi.name && !pi.specification && !pi.sku)) continue

      const sku = pi.sku?.trim() || null
      const name = pi.name?.trim() || sku || '未命名商品'
      const specification = pi.specification?.trim() || null
      const unit = pi.unit?.trim() || 'PCS'
      const countryOfOrigin = pi.countryOfOrigin?.trim() || null

      let product = null
      let productCreated = false

      // 優先用 SKU 比對（唯一）
      if (sku) {
        product = await prisma.pRD_Product.findFirst({
          where: { sku: { equals: sku, mode: 'insensitive' } },
        })
      }

      // SKU 找不到再用品名模糊比對
      if (!product) {
        product = await prisma.pRD_Product.findFirst({
          where: { name: { contains: name, mode: 'insensitive' } },
        })
      }

      // 都找不到 → 自動建立
      if (!product) {
        let finalSku = sku
        if (finalSku) {
          const existing = await prisma.pRD_Product.findUnique({ where: { sku: finalSku } })
          if (existing) finalSku = null
        }

        product = await prisma.pRD_Product.create({
          data: {
            name,
            sku: finalSku,
            specification,
            unit,
            countryOfOrigin,
          },
        })
        productCreated = true
      }

      // 確保供應商-商品關聯存在（不論是新建或已存在的產品）
      if (supplierId) {
        await prisma.sUP_SupplierProduct.upsert({
          where: { supplierId_productId: { supplierId, productId: product.id } },
          create: { supplierId, productId: product.id, isPreferred: true },
          update: {},  // 已存在則不覆蓋
        }).catch(() => {})
      }

      items.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        productCreated,
        qty: pi.qty ?? 1,
        unitPrice: pi.unitPrice ?? 0,
        unit: unit,
      })
    }

    const result: AppliedInvoice = {
      supplierId,
      supplierName,
      supplierCreated,
      currency: parsed.currency ?? 'USD',
      invoiceNo: parsed.invoiceNo ?? null,
      invoiceDate: parsed.invoiceDate ?? null,
      notes: parsed.notes ?? null,
      items,
    }

    return NextResponse.json({ ok: true, data: result })

  } catch (err) {
    console.error('[POST /api/ai/apply-invoice]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
