import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { patiscoLogin, getBuyers, getSellers } from '@/api/patisco/client'

// GET /api/patisco/company-aliases
// 回傳：
//   1. 所有已儲存的 alias 清單
//   2. 目前待確認（SYS_PatiscoSync status=needs_confirm）的公司名稱清單
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [aliases, pendingSyncs] = await Promise.all([
    prisma.sYS_CompanyAlias.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    }),
    prisma.sYS_PatiscoSync.findMany({
      where: { status: 'needs_confirm' },
      orderBy: { syncedAt: 'desc' },
      select: { id: true, docType: true, patiscoDocNo: true, syncedAt: true, result: true },
    }),
  ])

  // 從 pendingSyncs 提取待確認的公司名稱（去重）
  const pendingMap = new Map<string, {
    name: string
    roleHint: string
    docType: string
    docNos: string[]
  }>()

  for (const sync of pendingSyncs) {
    const res = sync.result as { unknownCompanies?: Array<{ name: string; roleHint: string; docType: string }> } | null
    for (const uc of res?.unknownCompanies ?? []) {
      const key = uc.name.trim().toLowerCase()
      if (!pendingMap.has(key)) {
        pendingMap.set(key, { name: uc.name, roleHint: uc.roleHint, docType: uc.docType, docNos: [] })
      }
      pendingMap.get(key)!.docNos.push(sync.patiscoDocNo)
    }
  }

  return NextResponse.json({
    aliases,
    pending: Array.from(pendingMap.values()),
  })
}

// POST /api/patisco/company-aliases
// body: { alias: string; role: 'SELF'|'CUSTOMER'|'SUPPLIER'|'OTHER'; customerId?: number; supplierId?: number }
// 儲存後，將 SYS_PatiscoSync 中含此公司名稱的 needs_confirm 記錄標記為 retry
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    alias: string
    role: 'SELF' | 'CUSTOMER' | 'SUPPLIER' | 'OTHER'
    customerId?: number
    supplierId?: number
  }

  if (!body.alias?.trim() || !body.role) {
    return NextResponse.json({ error: 'alias 和 role 為必填' }, { status: 400 })
  }

  const aliasKey = body.alias.trim().toLowerCase()
  const displayName = body.alias.trim()

  // 若角色為 CUSTOMER/SUPPLIER 且未提供 master ID，自動建立主檔並從 Patisco 補充完整資料
  let resolvedCustomerId = body.customerId ?? null
  let resolvedSupplierId = body.supplierId ?? null

  const creds = await patiscoLogin(prisma)

  if (body.role === 'CUSTOMER' && !resolvedCustomerId) {
    // 嘗試從 Patisco 取得完整買家資料
    let patiscoData: { name: string; address?: string | null; city?: string | null; countryCode?: string | null; postalCode?: string | null; phoneNo?: string | null; fax?: string | null; email?: string | null; contactPerson?: string | null; taxId?: string | null; note?: string | null; patiscoBuyerId?: string } = { name: displayName }
    if (creds) {
      const res = await getBuyers(creds, { filter: { Name: displayName }, first: 1 })
      const buyer = res.ok ? res.data?.items?.[0] : undefined
      if (buyer) {
        patiscoData = {
          name:          buyer.Name || displayName,
          address:       buyer.Address       ?? null,
          city:          buyer.City          ?? null,
          countryCode:   buyer.CountryCode   ?? null,
          postalCode:    buyer.PostalCode    ?? null,
          phoneNo:       buyer.PhoneNo       ?? null,
          fax:           buyer.FAX           ?? null,
          email:         buyer.EMail         ?? null,
          contactPerson: buyer.ContactPerson ?? null,
          taxId:         buyer.TaxID         ?? null,
          note:          buyer.Note          ?? null,
          patiscoBuyerId: buyer.ID,
        }
      }
    }
    const existing = await prisma.cUS_Customer.findFirst({
      where: { OR: [
        { name: { equals: displayName, mode: 'insensitive' } },
        ...(patiscoData.patiscoBuyerId ? [{ patiscoBuyerId: patiscoData.patiscoBuyerId }] : []),
      ]},
      select: { id: true },
    })
    if (existing) {
      await prisma.cUS_Customer.update({ where: { id: existing.id }, data: patiscoData })
      resolvedCustomerId = existing.id
    } else {
      const rec = await prisma.cUS_Customer.create({ data: patiscoData })
      resolvedCustomerId = rec.id
    }
  }

  if (body.role === 'SUPPLIER' && !resolvedSupplierId) {
    // 嘗試從 Patisco 取得完整賣家資料
    let patiscoData: { name: string; address?: string | null; city?: string | null; countryCode?: string | null; postalCode?: string | null; phoneNo?: string | null; fax?: string | null; email?: string | null; contactPerson?: string | null; taxId?: string | null; note?: string | null; patiscoSupplierId?: string } = { name: displayName }
    if (creds) {
      const res = await getSellers(creds, { filter: { Name: displayName }, first: 1, offset: 0 })
      const seller = res.ok ? res.data?.items?.[0] : undefined
      if (seller) {
        patiscoData = {
          name:          seller.Name || displayName,
          address:       seller.Address       ?? null,
          city:          seller.City          ?? null,
          countryCode:   seller.CountryCode   ?? null,
          postalCode:    seller.PostalCode    ?? null,
          phoneNo:       seller.PhoneNo       ?? null,
          fax:           seller.FAX           ?? null,
          email:         seller.EMail         ?? null,
          contactPerson: seller.ContactPerson ?? null,
          taxId:         seller.TaxID         ?? null,
          note:          seller.Note          ?? null,
          patiscoSupplierId: seller.ID,
        }
      }
    }
    const existing = await prisma.sUP_Supplier.findFirst({
      where: { OR: [
        { name: { equals: displayName, mode: 'insensitive' } },
        ...(patiscoData.patiscoSupplierId ? [{ patiscoSupplierId: patiscoData.patiscoSupplierId }] : []),
      ]},
      select: { id: true },
    })
    if (existing) {
      await prisma.sUP_Supplier.update({ where: { id: existing.id }, data: patiscoData })
      resolvedSupplierId = existing.id
    } else {
      const rec = await prisma.sUP_Supplier.create({ data: patiscoData })
      resolvedSupplierId = rec.id
    }
  }

  // upsert alias（同一個 alias 可以更新角色）
  const created = await prisma.sYS_CompanyAlias.upsert({
    where:  { alias: aliasKey },
    create: {
      alias:      aliasKey,
      role:       body.role,
      customerId: resolvedCustomerId,
      supplierId: resolvedSupplierId,
    },
    update: {
      role:       body.role,
      customerId: resolvedCustomerId,
      supplierId: resolvedSupplierId,
    },
    include: {
      customer: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
    },
  })

  // 將含此公司名稱的 needs_confirm 記錄標記為 error（讓下次 sync 重試）
  const pendingSyncs = await prisma.sYS_PatiscoSync.findMany({
    where: { status: 'needs_confirm' },
    select: { id: true, result: true },
  })

  const toRetry: number[] = []
  for (const sync of pendingSyncs) {
    const res = sync.result as { unknownCompanies?: Array<{ name: string }> } | null
    const hasThis = res?.unknownCompanies?.some(
      uc => uc.name.trim().toLowerCase() === aliasKey
    )
    if (hasThis) toRetry.push(sync.id)
  }

  if (toRetry.length > 0) {
    await prisma.sYS_PatiscoSync.deleteMany({ where: { id: { in: toRetry } } })
    // 刪除後下次 syncPatiscoPIs/syncPatiscoSupplierPOs 會重新處理這些文件
  }

  return NextResponse.json({ ok: true, alias: created, retriggered: toRetry.length })
}

// DELETE /api/patisco/company-aliases?alias=xxx
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const alias = new URL(req.url).searchParams.get('alias')
  if (!alias) return NextResponse.json({ error: 'alias 為必填' }, { status: 400 })

  await prisma.sYS_CompanyAlias.deleteMany({ where: { alias: alias.trim().toLowerCase() } })
  return NextResponse.json({ ok: true })
}
