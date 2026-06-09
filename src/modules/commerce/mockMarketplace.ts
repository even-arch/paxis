export type MarketplacePlatform = 'shopee' | 'ruten' | 'momo'

export type CommerceProductSnapshot = {
  id: number
  name: string
  sku: string | null
  unit: string | null
  sellingPrice: string | null
  quantity: number
  reservedQty: number
}

export type CommerceOrderItem = {
  platformItemId: string
  productId: number
  sku: string
  name: string
  quantity: number
  unitPrice: string
  unit: string | null
  availableQty: number
}

export type CommerceOrder = {
  id: string
  platform: MarketplacePlatform
  platformOrderNo: string
  accountName: string
  status: 'paid' | 'ready_to_ship' | 'overdue_risk'
  consumer: {
    name: string
    phone: string
    email: string
  }
  shippingAddress: {
    city: string
    district: string
    address: string
    zipCode: string
    deliveryType: 'home' | '711' | 'family'
  }
  fulfillmentMode: 'own_stock' | 'purchase_first' | 'dropship'
  carrierPreference: string
  shipBy: string
  orderedAt: string
  items: CommerceOrderItem[]
  shippingFee: string
  platformFee: string
  totalAmount: string
}

export const PLATFORM_LABELS: Record<MarketplacePlatform, string> = {
  shopee: '蝦皮',
  ruten: '露天',
  momo: 'momo',
}

export const FULFILLMENT_LABELS: Record<CommerceOrder['fulfillmentMode'], string> = {
  own_stock: '自有庫存',
  purchase_first: '調貨後出貨',
  dropship: '供應商直發',
}

function addHours(base: Date, hours: number) {
  return new Date(base.getTime() + hours * 60 * 60 * 1000).toISOString()
}

function priceOf(product: CommerceProductSnapshot, fallback: number) {
  const parsed = product.sellingPrice ? Number(product.sellingPrice) : fallback
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function lineItem(
  product: CommerceProductSnapshot,
  platformItemId: string,
  quantity: number,
  fallbackPrice: number,
): CommerceOrderItem {
  return {
    platformItemId,
    productId: product.id,
    sku: product.sku ?? `PAXIS-${product.id}`,
    name: product.name,
    quantity,
    unitPrice: priceOf(product, fallbackPrice).toFixed(2),
    unit: product.unit,
    availableQty: product.quantity - product.reservedQty,
  }
}

function totalFor(items: CommerceOrderItem[], shippingFee: number) {
  return items
    .reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, shippingFee)
    .toFixed(2)
}

export function buildMockMarketplaceOrders(products: CommerceProductSnapshot[]): CommerceOrder[] {
  if (products.length === 0) return []

  const now = new Date()
  const first = products[0]
  const second = products[1] ?? products[0]
  const third = products[2] ?? products[0]

  const shopeeItems = [
    lineItem(first, 'SP-ITM-1001', Math.max(1, Math.min(2, first.quantity - first.reservedQty || 1)), 680),
  ]
  const rutenItems = [
    lineItem(second, 'RT-ITM-2041', Math.max(1, (second.quantity - second.reservedQty) + 3), 420),
  ]
  const momoItems = [
    lineItem(first, 'MM-ITM-3218', 1, 680),
    lineItem(third, 'MM-ITM-3219', Math.max(1, Math.min(3, third.quantity - third.reservedQty || 1)), 980),
  ]

  return [
    {
      id: 'mock-shopee-001',
      platform: 'shopee',
      platformOrderNo: 'SPX-20260607-0018',
      accountName: 'Point Asia 蝦皮館',
      status: 'ready_to_ship',
      consumer: { name: '林佳蓉', phone: '0912-345-678', email: 'buyer001@example.com' },
      shippingAddress: {
        city: '台北市',
        district: '大安區',
        address: '復興南路一段 100 號 5 樓',
        zipCode: '106',
        deliveryType: 'home',
      },
      fulfillmentMode: 'own_stock',
      carrierPreference: '黑貓宅急便',
      shipBy: addHours(now, 30),
      orderedAt: addHours(now, -6),
      items: shopeeItems,
      shippingFee: '80.00',
      platformFee: '42.00',
      totalAmount: totalFor(shopeeItems, 80),
    },
    {
      id: 'mock-ruten-001',
      platform: 'ruten',
      platformOrderNo: 'RTN-20260607-0042',
      accountName: 'Point Asia 露天賣場',
      status: 'overdue_risk',
      consumer: { name: '許哲維', phone: '0988-111-222', email: 'buyer042@example.com' },
      shippingAddress: {
        city: '新北市',
        district: '板橋區',
        address: '文化路二段 88 號',
        zipCode: '220',
        deliveryType: '711',
      },
      fulfillmentMode: 'purchase_first',
      carrierPreference: '7-11 超取',
      shipBy: addHours(now, 12),
      orderedAt: addHours(now, -18),
      items: rutenItems,
      shippingFee: '60.00',
      platformFee: '28.00',
      totalAmount: totalFor(rutenItems, 60),
    },
    {
      id: 'mock-momo-001',
      platform: 'momo',
      platformOrderNo: 'MOMO-20260607-0107',
      accountName: 'Point Asia momo 供應商',
      status: 'paid',
      consumer: { name: '張雅婷', phone: '0933-555-888', email: 'buyer107@example.com' },
      shippingAddress: {
        city: '台中市',
        district: '西屯區',
        address: '市政北七路 168 號',
        zipCode: '407',
        deliveryType: 'home',
      },
      fulfillmentMode: 'own_stock',
      carrierPreference: '新竹物流',
      shipBy: addHours(now, 48),
      orderedAt: addHours(now, -2),
      items: momoItems,
      shippingFee: '100.00',
      platformFee: '55.00',
      totalAmount: totalFor(momoItems, 100),
    },
  ]
}

export function findMockMarketplaceOrder(
  orderId: string,
  products: CommerceProductSnapshot[],
) {
  return buildMockMarketplaceOrders(products).find(order => order.id === orderId) ?? null
}

export function assessCommerceOrder(order: CommerceOrder) {
  const insufficientItems = order.items.filter(item => item.availableQty < item.quantity)
  return {
    canImport: insufficientItems.length === 0,
    insufficientItems,
  }
}
