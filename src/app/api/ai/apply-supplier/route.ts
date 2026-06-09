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
  /** 前端使用者確認「不是現有供應商，直接新建」時傳 true */
  forceCreate?: boolean
  /** 前端使用者選擇「這就是現有供應商」時傳入 id */
  useExistingId?: number | null
}

export interface AppliedSupplier {
  supplierId: number
  supplierName: string
  supplierCreated: boolean
}

export interface SupplierCandidate {
  id: number
  name: string
  shortName: string | null
  city: string | null
  countryCode: string | null
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const {
      supplierName, supplierEmail, supplierShortName, contactPerson,
      paymentTerms, currencyCode, phone, address, city, country,
      postalCode, taxId, forceCreate, useExistingId,
    } = await req.json() as ApplySupplierInput

    const name = supplierName?.trim() ?? ''
    if (!name) return NextResponse.json({ error: '供應商名稱不能為空' }, { status: 400 })

    // 前端明確選擇某個現有供應商 → 直接用，補填空白欄位
    if (useExistingId) {
      let supplier = await prisma.sUP_Supplier.findUnique({ where: { id: useExistingId } })
      if (!supplier) return NextResponse.json({ error: '指定的供應商不存在' }, { status: 404 })

      const patch: Record<string, string> = {}
      if (!supplier.countryCode && country)    patch.countryCode   = country
      if (!supplier.city && city)              patch.city          = city
      if (!supplier.address && address)        patch.address       = address
      if (!supplier.email && supplierEmail)    patch.email         = supplierEmail
      if (!supplier.phoneNo && phone)          patch.phoneNo       = phone
      if (!supplier.contactPerson && contactPerson) patch.contactPerson = contactPerson
      if (Object.keys(patch).length > 0) {
        supplier = await prisma.sUP_Supplier.update({ where: { id: supplier.id }, data: patch })
      }
      return NextResponse.json({
        ok: true,
        data: { supplierId: supplier.id, supplierName: supplier.name, supplierCreated: false } as AppliedSupplier,
      })
    }

    // 1. 完全匹配（name 或 shortName 完全一致，不區分大小寫）
    let supplier = await prisma.sUP_Supplier.findFirst({
      where: {
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { shortName: { equals: name, mode: 'insensitive' } },
        ],
      },
    })

    if (supplier) {
      // 完全匹配：補填空白欄位（不覆蓋已有值）
      const patch: Record<string, string> = {}
      if (!supplier.countryCode && country)    patch.countryCode   = country
      if (!supplier.city && city)              patch.city          = city
      if (!supplier.address && address)        patch.address       = address
      if (!supplier.email && supplierEmail)    patch.email         = supplierEmail
      if (!supplier.phoneNo && phone)          patch.phoneNo       = phone
      if (!supplier.contactPerson && contactPerson) patch.contactPerson = contactPerson
      if (Object.keys(patch).length > 0) {
        supplier = await prisma.sUP_Supplier.update({ where: { id: supplier.id }, data: patch })
      }
      return NextResponse.json({
        ok: true,
        data: { supplierId: supplier.id, supplierName: supplier.name, supplierCreated: false } as AppliedSupplier,
      })
    }

    // 2. 無完全匹配 → 嘗試模糊比對
    //    若 forceCreate=true（使用者確認不是現有供應商），跳過此步驟直接建立
    if (!forceCreate) {
      const candidates = await prisma.sUP_Supplier.findMany({
        where: { name: { contains: name, mode: 'insensitive' } },
        select: { id: true, name: true, shortName: true, city: true, countryCode: true },
        take: 5,
      })
      if (candidates.length > 0) {
        return NextResponse.json({ ok: true, needConfirm: true, candidates, data: null })
      }
    }

    // 3. 找不到或使用者確認新建 → 建立供應商
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

    return NextResponse.json({
      ok: true,
      data: { supplierId: supplier.id, supplierName: supplier.name, supplierCreated: true } as AppliedSupplier,
    })
  } catch (err) {
    console.error('[POST /api/ai/apply-supplier]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
