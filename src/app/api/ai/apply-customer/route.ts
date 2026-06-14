import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export interface AppliedCustomer {
  customerId: number
  customerName: string
  customerCreated: boolean
}

export async function POST(req: NextRequest) {
  const prisma = await getRequestPrisma()
    try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      customerName: string
      customerShortName?: string | null
      customerEmail?: string | null
      customerPhone?: string | null
      customerAddress?: string | null
      customerCity?: string | null
      customerCountry?: string | null
      customerPostalCode?: string | null
      customerTaxId?: string | null
      contactPerson?: string | null
      paymentTerms?: string | null
      currencyCode?: string | null
      /** 若使用者明確選擇沿用現有客戶，傳入其 id，直接回傳不新建 */
      matchedId?: number | null
    }

    if (!body.customerName?.trim()) {
      return NextResponse.json({ error: '客戶名稱為必填' }, { status: 400 })
    }

    // ── 使用者明確選擇現有客戶 ──────────────────────────────────────────────
    if (body.matchedId) {
      const existing = await prisma.cUS_Customer.findUnique({ where: { id: body.matchedId } })
      if (existing) {
        return NextResponse.json({ ok: true, data: {
          customerId: existing.id, customerName: existing.name, customerCreated: false,
        } })
      }
    }

    // ── 名稱比對（避免漏掉已存在的客戶）───────────────────────────────────
    const name = body.customerName.trim()
    let customer = await prisma.cUS_Customer.findFirst({
      where: {
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { shortName: { equals: name, mode: 'insensitive' } },
        ],
      },
    })

    let customerCreated = false
    if (!customer) {
      customer = await prisma.cUS_Customer.create({
        data: {
          name,
          shortName: body.customerShortName?.trim() || null,
          email: body.customerEmail?.trim() || null,
          phoneNo: body.customerPhone?.trim() || null,
          address: body.customerAddress?.trim() || null,
          city: body.customerCity?.trim() || null,
          countryCode: body.customerCountry?.trim() || null,
          postalCode: body.customerPostalCode?.trim() || null,
          taxId: body.customerTaxId?.trim() || null,
          contactPerson: body.contactPerson?.trim() || null,
          paymentTerms: body.paymentTerms?.trim() || null,
          currencyCode: body.currencyCode?.trim() || null,
        },
      })
      customerCreated = true
    }

    const result: AppliedCustomer = {
      customerId: customer.id,
      customerName: customer.name,
      customerCreated,
    }

    return NextResponse.json({ ok: true, data: result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/ai/apply-customer]', msg)
    return NextResponse.json({ error: `寫入失敗：${msg}` }, { status: 500 })
  }
}
