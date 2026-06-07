import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export interface ApplySupplierInput {
  supplierName: string
  supplierEmail?: string | null
  supplierShortName?: string | null
  contactPerson?: string | null
  paymentTerms?: string | null
  currencyCode?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  country?: string | null
  postalCode?: string | null
  taxId?: string | null
}

export interface AppliedSupplier {
  supplierId: number
  supplierName: string
  supplierCreated: boolean
}

export async function POST(req: NextRequest) {
    try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { supplierName, supplierEmail, supplierShortName, contactPerson, paymentTerms, currencyCode, phone, address, city, country, postalCode, taxId } = await req.json() as ApplySupplierInput
    const name = supplierName?.trim() ?? ''
    if (!name) return NextResponse.json({ error: '供應商名稱不能為空' }, { status: 400 })

    let supplier = await prisma.sUP_Supplier.findFirst({
      where: {
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { shortName: { equals: name, mode: 'insensitive' } },
          { name: { contains: name, mode: 'insensitive' } },
        ],
      },
    })

    let supplierCreated = false
    if (!supplier) {
      supplier = await prisma.sUP_Supplier.create({
        data: {
          name,
          shortName:     supplierShortName?.trim() || (name.length > 20 ? name.slice(0, 20) : null),
          email:         supplierEmail ?? null,
          contactPerson: contactPerson ?? null,
          paymentTerms:  paymentTerms ?? null,
          currencyCode:  currencyCode ?? null,
          phoneNo:       phone ?? null,
          address:       address ?? null,
          city:          city ?? null,
          countryCode:   country ?? null,
          postalCode:    postalCode ?? null,
          taxId:         taxId ?? null,
        },
      })
      supplierCreated = true
    }

    return NextResponse.json({
      ok: true,
      data: { supplierId: supplier.id, supplierName: supplier.name, supplierCreated } as AppliedSupplier,
    })
  } catch (err) {
    console.error('[POST /api/ai/apply-supplier]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
