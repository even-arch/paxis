import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export interface AppliedCustomer {
  customerId: number
  customerName: string
  customerCreated: boolean
}

export async function POST(req: NextRequest) {
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
      contactPerson?: string | null
      paymentTerms?: string | null
      currencyCode?: string | null
    }

    if (!body.customerName?.trim()) {
      return NextResponse.json({ error: '客戶名稱為必填' }, { status: 400 })
    }

    const customer = await prisma.cUS_Customer.create({
      data: {
        name: body.customerName.trim(),
        shortName: body.customerShortName?.trim() || null,
        email: body.customerEmail?.trim() || null,
        phoneNo: body.customerPhone?.trim() || null,
        address: body.customerAddress?.trim() || null,
        city: body.customerCity?.trim() || null,
        countryCode: body.customerCountry?.trim() || null,
        contactPerson: body.contactPerson?.trim() || null,
        paymentTerms: body.paymentTerms?.trim() || null,
        currencyCode: body.currencyCode?.trim() || null,
      },
    })

    const result: AppliedCustomer = {
      customerId: customer.id,
      customerName: customer.name,
      customerCreated: true,
    }

    return NextResponse.json({ ok: true, data: result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/ai/apply-customer]', msg)
    return NextResponse.json({ error: `寫入失敗：${msg}` }, { status: 500 })
  }
}
