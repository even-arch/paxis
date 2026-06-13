import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import CustomerForm, { type CustomerFormData } from '@/modules/customer/CustomerForm'

type Props = { params: { id: string } }

export default async function EditCustomerPage({
  params }: Props) {
    const customer = await prisma.cUS_Customer.findUnique({
    where: { id: Number(params.id) },
  })

  if (!customer || !customer.isActive) notFound()

  const initialData: Partial<CustomerFormData> = {
    name: customer.name,
    shortName: customer.shortName ?? '',
    address: customer.address ?? '',
    city: customer.city ?? '',
    countryCode: customer.countryCode ?? '',
    postalCode: customer.postalCode ?? '',
    phoneNo: customer.phoneNo ?? '',
    fax: customer.fax ?? '',
    email: customer.email ?? '',
    contactPerson: customer.contactPerson ?? '',
    taxId: customer.taxId ?? '',
    paymentTerms: customer.paymentTerms ?? '',
    currencyCode: customer.currencyCode ?? '',
    patiscoBuyerId: customer.patiscoBuyerId ? String(customer.patiscoBuyerId) : '',
    shippingMarkTemplate: customer.shippingMarkTemplate ?? '',
    note: customer.note ?? '',
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">編輯客戶</h1>
      <CustomerForm initialData={initialData} customerId={params.id} />
    </div>
  )
}
