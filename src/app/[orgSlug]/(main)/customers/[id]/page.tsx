import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import DeleteCustomerButton from './DeleteCustomerButton'

type Props = { params: { id: string } }

export default async function CustomerDetailPage({
  params }: Props) {
    const [customer, recentOrders, purchasedItems] = await Promise.all([
    prisma.cUS_Customer.findUnique({
      where: { id: Number(params.id) },
      include: {
        contacts: true,
        chargeTemplate: { select: { id: true, name: true, description: true } },
      },
    }),
    prisma.sLS_Order.findMany({
      where: { customerId: Number(params.id) },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { _count: { select: { items: true } } },
    }),
    prisma.sLS_Item.findMany({
      where: { order: { customerId: Number(params.id) } },
      distinct: ['productId'],
      include: { product: { select: { id: true, name: true, sku: true } } },
      orderBy: { product: { name: 'asc' } },
    }),
  ])

  if (!customer || !customer.isActive) notFound()

  const STATUS_LABELS: Record<number, { label: string; color: string }> = {
    0: { label: '草稿',    color: 'bg-gray-100 text-gray-500' },
    1: { label: '已確認',  color: 'bg-blue-100 text-blue-700' },
    2: { label: 'PI 已發', color: 'bg-purple-100 text-purple-700' },
    3: { label: '部分出貨', color: 'bg-amber-100 text-amber-700' },
    4: { label: '完成',    color: 'bg-green-100 text-green-700' },
    5: { label: '取消',    color: 'bg-red-100 text-red-500' },
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/customers" className="text-sm text-gray-400 hover:text-gray-600">← 客戶</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">{customer.name}</h1>
          {customer.shortName && <p className="text-sm text-gray-500">{customer.shortName}</p>}
        </div>
        <div className="flex gap-2">
          <Link href={`/customers/${params.id}/edit`}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
            編輯
          </Link>
          <DeleteCustomerButton customerId={params.id} />
        </div>
      </div>

      <div className="space-y-4">
        <Card title="基本資料">
          <Row label="客戶名稱" value={customer.name} />
          <Row label="簡稱" value={customer.shortName} />
          <Row label="慣用幣別" value={customer.currencyCode} />
          <Row label="付款條件" value={customer.paymentTerms} />
          <Row label="統一編號" value={customer.taxId} />
          {customer.patiscoBuyerId && (
            <Row label="Patisco Buyer ID" value={String(customer.patiscoBuyerId)} />
          )}
        </Card>

        <Card title="聯絡資訊">
          <Row label="主要聯絡人" value={customer.contactPerson} />
          <Row label="Email" value={customer.email} />
          <Row label="電話" value={customer.phoneNo} />
          <Row label="傳真" value={customer.fax} />
        </Card>

        <Card title="地址">
          <Row label="地址" value={customer.address} />
          <Row label="城市" value={customer.city} />
          <Row label="國家" value={customer.countryCode} />
          <Row label="郵遞區號" value={customer.postalCode} />
        </Card>

        {customer.chargeTemplate && (
          <Card title="列印費用模板">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">{customer.chargeTemplate.name}</p>
                {customer.chargeTemplate.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{customer.chargeTemplate.description}</p>
                )}
              </div>
              <Link href={`/settings/charge-templates`} className="text-xs text-blue-500 hover:underline">
                管理模板 →
              </Link>
            </div>
          </Card>
        )}

        {customer.note && (
          <Card title="備註">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{customer.note}</p>
          </Card>
        )}

        <Card title={`客戶訂單記錄（${recentOrders.length} 筆）`}>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-gray-400">尚無客戶訂單</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="text-left py-2 font-medium">單號</th>
                  <th className="text-left py-2 font-medium">品項數</th>
                  <th className="text-left py-2 font-medium">幣別</th>
                  <th className="text-left py-2 font-medium">狀態</th>
                  <th className="text-left py-2 font-medium">建立日期</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentOrders.map(o => {
                  const badge = STATUS_LABELS[o.status] ?? STATUS_LABELS[0]
                  return (
                    <tr key={o.id}>
                      <td className="py-2">
                        <Link href={`/sales/${o.id}`} className="font-mono text-blue-600 hover:underline">
                          {o.orderNo}
                        </Link>
                      </td>
                      <td className="py-2 text-gray-600">{o._count.items}</td>
                      <td className="py-2 text-gray-600">{o.currencyCode}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>{badge.label}</span>
                      </td>
                      <td className="py-2 text-gray-500">{formatDate(o.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {recentOrders.length >= 20 && (
            <Link href={`/sales?customerId=${params.id}`} className="text-xs text-blue-600 hover:underline mt-2 block">
              查看全部 →
            </Link>
          )}
        </Card>

        {/* 曾購商品（從訂單自動勾稽） */}
        <Card title={`曾購商品（${purchasedItems.length} 項）`}>
          {purchasedItems.length === 0 ? (
            <p className="text-sm text-gray-400">尚無訂單記錄，建立客戶訂單後自動更新。</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {purchasedItems.map(item => (
                <div key={item.productId} className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm font-medium text-gray-800">{item.product?.name ?? '-'}</span>
                    {item.product?.sku && (
                      <span className="ml-2 text-xs font-mono text-gray-400">{item.product.sku}</span>
                    )}
                  </div>
                  <Link href={`/products/${item.productId}`} className="text-xs text-blue-500 hover:underline">
                    查看商品 →
                  </Link>
                </div>
              ))}
            </div>
          )}
          {purchasedItems.length > 0 && (
            <Link href={`/sales?customerId=${params.id}`} className="text-xs text-blue-600 hover:underline mt-3 block">
              查看此客戶所有訂單 →
            </Link>
          )}
        </Card>

        <p className="text-xs text-gray-400">建立時間：{formatDate(customer.createdAt)}</p>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-base font-semibold text-gray-700 mb-3">{title}</h2>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex py-1.5 text-sm border-b border-gray-50 last:border-0">
      <span className="w-36 text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-800">{value || '-'}</span>
    </div>
  )
}
