import CustomerForm from '@/modules/customer/CustomerForm'

export default function NewCustomerPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">新增客戶</h1>
      <CustomerForm />
    </div>
  )
}
