import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 公開端點：登入頁取得公司名稱與 Logo（不含敏感資訊）
export async function GET() {
  const company = await prisma.sYS_Company.findFirst({ where: { id: 1 } })
  return NextResponse.json({
    nameZh: company?.nameZh ?? '',
    nameEn: company?.nameEn ?? '',
    shortName: company?.shortName ?? '',
    logoBase64: company?.logoBase64 ?? null,
  })
}
