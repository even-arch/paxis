import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const { nameZh, nameEn, shortName, taxId, phone, email } = await req.json()

  if (!nameZh?.trim() && !nameEn?.trim()) {
    return NextResponse.json({ error: '請至少填寫中文或英文公司名稱' }, { status: 400 })
  }

  const prisma = await getRequestPrisma()

  const existing = await prisma.sYS_Company.findFirst()
  if (existing) {
    await prisma.sYS_Company.update({
      where: { id: existing.id },
      data: {
        nameZh: nameZh?.trim() ?? '',
        nameEn: nameEn?.trim() ?? '',
        shortName: shortName?.trim() ?? '',
        taxId: taxId?.trim() ?? '',
        phone: phone?.trim() ?? '',
        email: email?.trim() ?? '',
      },
    })
  } else {
    await prisma.sYS_Company.create({
      data: {
        nameZh: nameZh?.trim() ?? '',
        nameEn: nameEn?.trim() ?? '',
        shortName: shortName?.trim() ?? '',
        taxId: taxId?.trim() ?? '',
        phone: phone?.trim() ?? '',
        email: email?.trim() ?? '',
      },
    })
  }

  return NextResponse.json({ ok: true })
}
