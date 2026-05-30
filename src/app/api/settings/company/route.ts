import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// 取得公司資料（若不存在自動建立空白記錄）
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

  const body = await req.json()

  // 只允許更新已知欄位，防止任意欄位注入
  const {
    nameZh, nameEn, shortName,
    addressZh, addressEn, city, countryCode,
    phone, fax, email, website,
    taxId, bankName, bankAccount, bankSwift,
    customFields, logoBase64,
  } = body

  const company = await prisma.sYS_Company.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      nameZh: nameZh ?? '', nameEn: nameEn ?? '', shortName: shortName ?? '',
      addressZh: addressZh ?? '', addressEn: addressEn ?? '',
      city: city ?? '', countryCode: countryCode ?? 'TW',
      phone: phone ?? '', fax: fax ?? '', email: email ?? '', website: website ?? '',
      taxId: taxId ?? '', bankName: bankName ?? '', bankAccount: bankAccount ?? '', bankSwift: bankSwift ?? '',
      customFields: customFields ?? [],
      logoBase64: logoBase64 ?? null,
    },
    update: {
      nameZh, nameEn, shortName,
      addressZh, addressEn, city, countryCode,
      phone, fax, email, website,
      taxId, bankName, bankAccount, bankSwift,
      customFields,
      logoBase64,
    },
  })

  return NextResponse.json(company)
}
