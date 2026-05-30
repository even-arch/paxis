import { prisma } from '@/lib/db'

export type CompanyProfile = Awaited<ReturnType<typeof getCompanyProfile>>

// Server-side: 取得公司資料，用於文件生成
export async function getCompanyProfile() {
  const company = await prisma.sYS_Company.findFirst({ where: { id: 1 } })
  return company ?? {
    id: 1,
    nameZh: '', nameEn: '', shortName: '',
    addressZh: '', addressEn: '', city: '', countryCode: 'TW',
    phone: '', fax: '', email: '', website: '',
    taxId: '', bankName: '', bankAccount: '', bankSwift: '',
    customFields: [] as { label: string; value: string }[],
    logoBase64: null as string | null,
    updatedAt: new Date(),
  }
}
