/**
 * GET /api/shipping/pi-list
 * 回傳近期有效 PI（含客戶地址、訂單金額、品項明細），供出貨頁快速帶入。
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const singleId = searchParams.get('id') ? Number(searchParams.get('id')) : null

  const pis = await prisma.pI.findMany({
    where: singleId ? { id: singleId } : { status: 0 },
    orderBy: { performedAt: 'desc' },
    take: 30,
    select: {
      id: true,
      piNo: true,
      orderId: true,
      totalAmount: true,
      currencyCode: true,
      customer: {
        select: { name: true, address: true, city: true, countryCode: true, postalCode: true, taxId: true },
      },
      order: {
        select: {
          id: true,
          totalAmount: true,
          currencyCode: true,
          customer: {
            select: { name: true, address: true, city: true, countryCode: true, postalCode: true, taxId: true },
          },
          items: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              unit: true,
              product: {
                select: { sku: true, modelNo: true, name: true, specification: true },
              },
            },
          },
        },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          unit: true,
          productId: true,
          slsItemId: true,
          product: {
            select: { sku: true, modelNo: true, name: true, specification: true },
          },
        },
      },
    },
  })

  const result = pis.map(pi => {
    const cust = pi.order?.customer ?? pi.customer
    const currCode = pi.order?.currencyCode ?? pi.currencyCode ?? ''
    const totalAmt = pi.order?.totalAmount ?? pi.totalAmount
    // Use PO_CustomerCopy items if available, otherwise fall back to PI's own items
    const orderItems = pi.order?.items ?? []
    const piItems = pi.items ?? []
    const mappedItems = orderItems.length > 0
      ? orderItems.map(it => ({
          slsItemId: it.id,
          sku: it.product.sku ?? '',
          modelNo: it.product.modelNo ?? '',
          name: it.product.name,
          specification: it.product.specification ?? '',
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
          unit: it.unit ?? 'PC',
          currencyCode: currCode,
        }))
      : piItems.map(it => ({
          slsItemId: it.slsItemId ?? null,
          sku: it.product?.sku ?? '',
          modelNo: it.product?.modelNo ?? '',
          name: it.product?.name ?? '',
          specification: it.product?.specification ?? '',
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
          unit: it.unit ?? 'PC',
          currencyCode: currCode,
        }))
    return {
      id: pi.id,
      piNo: pi.piNo,
      orderId: pi.orderId,
      customerName: cust?.name ?? null,
      totalAmount: totalAmt ? Number(totalAmt) : null,
      currencyCode: currCode,
      customerAddress: cust?.address ?? null,
      customerCity: cust?.city ?? null,
      customerCountry: cust?.countryCode ?? null,
      customerPostal: cust?.postalCode ?? null,
      customerTaxId: cust?.taxId ?? null,
      items: mappedItems,
    }
  })

  return NextResponse.json({ pis: result })
}
