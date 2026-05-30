import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import SupplierForm, { type SupplierFormData } from '@/modules/supplier/SupplierForm'

type Props = { params: { id: string } }

export default async function EditSupplierPage({ params }: Props) {
  const supplier = await prisma.sUP_Supplier.findUnique({
    where: { id: Number(params.id) },
  })

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
    note: supplier.note ?? '',
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">編輯供應商</h1>
      <SupplierForm initialData={initialData} supplierId={params.id} />
    </div>
  )
}
