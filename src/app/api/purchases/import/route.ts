import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { generatePoNo } from '@/lib/utils'

export interface ImportPurchaseInput {
  // 產品（已經過用戶確認）
  items: {
    name: string
    specification: string | null
    sku: string | null
    qty: number
    unitPrice: number
    unit: string
    action: 'create' | 'use-existing'
    existingId: number | null  // action='use-existing' 時使用
  }[]
  // 供應商
  supplier: {
    action: 'use-existing' | 'create'
    existingId: number | null
    name: string
    shortName?: string | null
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    country?: string | null
    contactPerson?: string | null
    paymentTerms?: string | null
    currencyCode?: string | null
  }
  // 供應商訂單基本資料
  po: {
    sourceType: number
    docRefNo: string
    currencyCode: string
    exchangeRate: string
    expectedDate: string
    port: string
    shipVia: string
    note: string
  }
}

export async function POST(req: NextRequest) {
  const prisma = await getRequestPrisma()
    try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as ImportPurchaseInput

    // ── 1. 處理供應商 ───────────────────────────────────────────────────────────
    let supplierId: number
    if (body.supplier.action === 'use-existing' && body.supplier.existingId) {
      supplierId = body.supplier.existingId
    } else {
      const name = body.supplier.name.trim()
      // 再次嘗試比對（防止剛好有同名）
      const existing = await prisma.sUP_Supplier.findFirst({
        where: { OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { shortName: { equals: name, mode: 'insensitive' } },
        ]},
      })
      if (existing) {
        supplierId = existing.id
      } else {
        const created = await prisma.sUP_Supplier.create({
          data: {
            name,
            shortName:     body.supplier.shortName?.trim() || (name.length > 20 ? name.slice(0, 20) : null),
            email:         body.supplier.email || null,
            phoneNo:       body.supplier.phone || null,
            address:       body.supplier.address || null,
            city:          body.supplier.city || null,
            countryCode:   body.supplier.country || null,
            contactPerson: body.supplier.contactPerson || null,
            paymentTerms:  body.supplier.paymentTerms || null,
            currencyCode:  body.supplier.currencyCode || null,
          },
        })
        supplierId = created.id
      }
    }

    // ── 2. 處理產品（按順序，取得每個 productId）──────────────────────────────────
    const resolvedItems: { productId: number; qty: number; unitPrice: number; unit: string }[] = []

    for (const item of body.items) {
      let productId: number

      if (item.action === 'use-existing' && item.existingId) {
        productId = item.existingId
      } else {
        const sku = item.sku?.trim() || null
        // SKU 比對
        let product = sku
          ? await prisma.pRD_Product.findFirst({ where: { sku: { equals: sku, mode: 'insensitive' } } })
          : null
        // 名稱模糊比對
        if (!product && item.name) {
          product = await prisma.pRD_Product.findFirst({
            where: { name: { equals: item.name.trim(), mode: 'insensitive' } },
          })
        }
        // 找不到 → 新建
        if (!product) {
          let finalSku = sku
          if (finalSku) {
            const dup = await prisma.pRD_Product.findUnique({ where: { sku: finalSku } })
            if (dup) finalSku = null
          }
          product = await prisma.pRD_Product.create({
            data: {
              name:          item.name.trim(),
              sku:           finalSku,
              specification: item.specification || null,
              unit:          item.unit || 'PCS',
            },
          })
        }
        productId = product.id
      }

      // 確保供應商-商品關聯
      await prisma.sUP_SupplierProduct.upsert({
        where:  { supplierId_productId: { supplierId, productId } },
        create: { supplierId, productId, isPreferred: true },
        update: {},
      }).catch(() => {})

      resolvedItems.push({ productId, qty: item.qty, unitPrice: item.unitPrice, unit: item.unit })
    }

    // ── 3. 建立供應商訂單 ──────────────────────────────────────────────────────────
    const po = body.po

    // 原始單號優先（供應商給的號碼不可修改）；無號碼時才由系統生成內部流水號供識別
    const poNo = po.docRefNo?.trim() || generatePoNo()

    const order = await prisma.pO.create({
      data: {
        poNo,
        supplierId,
        createdBy:    Number(session.user.id),
        sourceType:   po.sourceType,
        status:       0,
        currencyCode: po.currencyCode,
        exchangeRate: parseFloat(po.exchangeRate) || 1,
        expectedDate: po.expectedDate ? new Date(po.expectedDate) : null,
        port:         po.port || null,
        shipVia:      po.shipVia || null,
        note:         po.note || null,
        items: {
          create: resolvedItems.map(ri => ({
            productId: ri.productId,
            quantity:  ri.qty,
            unitPrice: ri.unitPrice,
            unit:      ri.unit,
          })),
        },
      },
    })

    return NextResponse.json({ ok: true, orderId: order.id, poNo: order.poNo })
  } catch (err) {
    console.error('[POST /api/purchases/import]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
