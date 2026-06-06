import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let company = await prisma.sYS_Company.findFirst({ where: { id: 1 } })
  if (!company) {
    company = await prisma.sYS_Company.create({ data: { id: 1 } })
  }
  return NextResponse.json(company)
}

export async function PUT(req: NextRequest) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = parseInt((session.user as { id?: string })?.id ?? '', 10)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const {
    nameZh, nameEn, shortName,
    addressZh, addressEn, city, countryCode,
    phone, fax, email, website,
    taxId, bankName, bankAccount, bankSwift,
    customFields, logoBase64,
    inventoryMethod,
    inventoryMethodReason, // 變更原因（僅當 inventoryMethod 有變時使用）
  } = body

  // 取得目前的計價方法，判斷是否有變更
  const current = await prisma.sYS_Company.findFirst({ where: { id: 1 } })
  const oldMethod = current?.inventoryMethod ?? 'WAC'
  const newMethod = inventoryMethod ?? 'WAC'
  const methodChanged = oldMethod !== newMethod

  const company = await prisma.sYS_Company.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      inventoryMethod: newMethod,
      nameZh: nameZh ?? '', nameEn: nameEn ?? '', shortName: shortName ?? '',
      addressZh: addressZh ?? '', addressEn: addressEn ?? '',
      city: city ?? '', countryCode: countryCode ?? 'TW',
      phone: phone ?? '', fax: fax ?? '', email: email ?? '', website: website ?? '',
      taxId: taxId ?? '', bankName: bankName ?? '', bankAccount: bankAccount ?? '', bankSwift: bankSwift ?? '',
      customFields: customFields ?? [],
      logoBase64: logoBase64 ?? null,
    },
    update: {
      inventoryMethod: newMethod,
      nameZh, nameEn, shortName,
      addressZh, addressEn, city, countryCode,
      phone, fax, email, website,
      taxId, bankName, bankAccount, bankSwift,
      customFields,
      logoBase64,
    },
  })

  // 計價方法有變更時，寫入稽核日誌
  if (methodChanged) {
    await prisma.sYS_SettingAuditLog.create({
      data: {
        field: 'inventoryMethod',
        oldValue: oldMethod,
        newValue: newMethod,
        reason: inventoryMethodReason ?? null,
        changedBy: userId,
      },
    })
  }

  return NextResponse.json(company)
}
