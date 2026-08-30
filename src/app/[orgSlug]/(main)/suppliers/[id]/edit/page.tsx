import { notFound } from 'next/navigation'
import { getPagePrisma } from '@/lib/page-db'
import SupplierForm, { type SupplierFormData } from '@/modules/supplier/SupplierForm'

type Props = { params: { orgSlug: string; id: string } }

export default async function EditSupplierPage({
  params }: Props) {
  const prisma = await getPagePrisma(params.orgSlug)
  const supplier = await prisma.sUP_Supplier.findUnique({
    where: { id: Number(params.id) },
    omit: { commissionPct: true },
  })

  // commissionPct 欄位可能尚未在 DB 中（等待 schema-sync），單獨讀取
  let commissionPctStr = ''
  try {
    const rows = await prisma.$queryRaw<{ commissionPct: string | null }[]>`
      SELECT "commissionPct"::text FROM "SUP_Supplier" WHERE id = ${Number(params.id)} LIMIT 1
    `
    commissionPctStr = rows[0]?.commissionPct ?? ''
  } catch { /* column not yet in DB */ }

  if (!supplier || !supplier.isActive) notFound()

  const initialData: Partial<SupplierFormData> = {
    name: supplier.name,
    shortName: supplier.shortName ?? '',
    address: supplier.address ?? '',
    city: supplier.city ?? '',
    countryCode: supplier.countryCode ?? '',
    postalCode: supplier.postalCode ?? '',
    phoneNo: supplier.phoneNo ?? '',
    fax: supplier.fax ?? '',
    email: supplier.email ?? '',
    contactPerson: supplier.contactPerson ?? '',
    taxId: supplier.taxId ?? '',
    paymentTerms: supplier.paymentTerms ?? '',
    currencyCode: supplier.currencyCode ?? '',
    defaultTradeTerms: supplier.defaultTradeTerms ?? '',
    commissionPct: commissionPctStr,
    note: supplier.note ?? '',
    chargeTemplateId: supplier.chargeTemplateId ? String(supplier.chargeTemplateId) : '',
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">編輯供應商</h1>
      <SupplierForm initialData={initialData} supplierId={params.id} />
    </div>
  )
}
