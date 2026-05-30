export const PO_STATUS = {
  0: { label: '草稿', color: 'bg-gray-100 text-gray-600' },
  1: { label: '已送出', color: 'bg-blue-100 text-blue-700' },
  2: { label: '部分到貨', color: 'bg-yellow-100 text-yellow-700' },
  3: { label: '完成', color: 'bg-green-100 text-green-700' },
  4: { label: '取消', color: 'bg-red-100 text-red-600' },
} as const

export function statusBadge(status: number) {
  const s = PO_STATUS[status as keyof typeof PO_STATUS] ?? { label: '未知', color: 'bg-gray-100 text-gray-500' }
  return s
}

export const SHIP_VIA = ['Sea Freight', 'Air Freight', 'Express', 'Truck', 'Rail']
export const CURRENCIES = ['USD', 'CNY', 'TWD', 'EUR', 'JPY']
