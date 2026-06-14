import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import type { ParsedInvoice } from '@/app/api/ai/parse-invoice/route'

export interface PreviewItem {
  index: number
  incoming: ParsedInvoice['items'][0]
  existing: {
    id: number; name: string; sku: string | null; modelNo: string | null
    specification: string | null; unit: string | null; unitCost: string | null
  } | null
  conflict: boolean // SKU 或品名已存在
  conflictType: 'sku' | 'name' | null
}

export async function POST(req: NextRequest) {
  const prisma = await getRequestPrisma()
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { items } = await req.json() as { items: ParsedInvoice['items'] }
  const results: PreviewItem[] = []

  for (let i = 0; i < (items ?? []).length; i++) {
    const item = items[i]
    if (!item || (!item.name && !item.sku)) continue

    const sku = item.sku?.trim() || null
    const name = (item.name?.trim() || sku || '未命名商品')

    let existing = null
    let conflictType: PreviewItem['conflictType'] = null

    if (sku) {
      const bysku = await prisma.pRD_Product.findUnique({
        where: { sku },
        select: { id: true, name: true, sku: true, modelNo: true, specification: true, unit: true, supplierProducts: { select: { unitPrice: true, currencyCode: true }, take: 1 } },
      })
      if (bysku) {
        const { supplierProducts, ...rest } = bysku
        existing = { ...rest, unitCost: supplierProducts[0]?.unitPrice?.toString() ?? null }
        conflictType = 'sku'
      }
    }

    if (!existing) {
      const byname = await prisma.pRD_Product.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true, name: true, sku: true, modelNo: true, specification: true, unit: true, supplierProducts: { select: { unitPrice: true, currencyCode: true }, take: 1 } },
      })
      if (byname) {
        const { supplierProducts, ...rest } = byname
        existing = { ...rest, unitCost: supplierProducts[0]?.unitPrice?.toString() ?? null }
        conflictType = 'name'
      }
    }

    results.push({
      index: i,
      incoming: { ...item, name },
      existing,
      conflict: existing !== null,
      conflictType,
    })
  }

  return NextResponse.json({ items: results })
}
