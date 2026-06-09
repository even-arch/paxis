import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

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

  if (body.role === 'CUSTOMER' && !body.customerId) {
    return NextResponse.json({ error: 'CUSTOMER 角色必須指定 customerId' }, { status: 400 })
  }
  if (body.role === 'SUPPLIER' && !body.supplierId) {
    return NextResponse.json({ error: 'SUPPLIER 角色必須指定 supplierId' }, { status: 400 })
  }

  const aliasKey = body.alias.trim().toLowerCase()

  // upsert alias（同一個 alias 可以更新角色）
  const created = await prisma.sYS_CompanyAlias.upsert({
    where:  { alias: aliasKey },
    create: {
      alias:      aliasKey,
      role:       body.role,
      customerId: body.customerId ?? null,
      supplierId: body.supplierId ?? null,
    },
    update: {
      role:       body.role,
      customerId: body.customerId ?? null,
      supplierId: body.supplierId ?? null,
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
