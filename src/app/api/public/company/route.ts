import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest) {
  const company = await prisma.sYS_Company.findFirst({ where: { id: 1 } })
  return NextResponse.json({
    nameZh: company?.nameZh ?? '',
    nameEn: company?.nameEn ?? '',
    shortName: company?.shortName ?? '',
    logoBase64: company?.logoBase64 ?? null,
  })
}
