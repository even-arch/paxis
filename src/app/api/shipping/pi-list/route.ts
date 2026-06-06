/**
 * GET /api/shipping/pi-list
 * 回傳近期有效 PI（含客戶地址、訂單金額、品項明細），供出貨頁快速帶入。
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  
  const pis = await prisma.sLS_PI.findMany({
    where: { status: 0 },
    orderBy: { performedAt: 'desc' },
    take: 30,
    select: {
      id: true,
      piNo: true,
      order: {
        select: {
          totalAmount: true,
          currencyCode: true,
          customer: {
            select: {
              name: true,
              address: true,
              city: true,
              countryCode: true,
              postalCode: true,
              taxId: true,
            },
          },
          items: {
            select: {
              quantity: true,
              unitPrice: true,
              unit: true,
              product: {
                select: {
                  sku: true,
                  modelNo: true,
                  name: true,
                  specification: true,
                },
              },
            },
          },
        },
      },
    },
  })

  const result = pis.map(pi => ({
    id: pi.id,
    piNo: pi.piNo,
    customerName: pi.order.customer?.name ?? null,
    totalAmount: pi.order.totalAmount ? Number(pi.order.totalAmount) : null,
    currencyCode: pi.order.currencyCode,
    customerAddress: pi.order.customer?.address ?? null,
    customerCity: pi.order.customer?.city ?? null,
    customerCountry: pi.order.customer?.countryCode ?? null,
    customerPostal: pi.order.customer?.postalCode ?? null,
    customerTaxId: pi.order.customer?.taxId ?? null,
    items: pi.order.items.map(it => ({
      sku: it.product.sku ?? '',
      modelNo: it.product.modelNo ?? '',
      name: it.product.name,
      specification: it.product.specification ?? '',
      quantity: it.quantity,
      unitPrice: Number(it.unitPrice),
      unit: it.unit ?? 'PC',
      currencyCode: pi.order.currencyCode,
    })),
  }))

  return NextResponse.json({ pis: result })
}
