import {
  PLATFORM_LABELS,
  assessCommerceOrder,
  type CommerceOrder,
} from './mockMarketplace'

export type OmsAssistPriority = 'high' | 'medium' | 'low'

export type OmsAssistRecommendation = {
  id: string
  priority: OmsAssistPriority
  title: string
  detail: string
  orderIds: string[]
}

export type OmsAssistResult = {
  readyToImport: number
  needsPurchase: number
  deadlineRisk: number
  carrierBatches: {
    carrier: string
    count: number
    orderNos: string[]
  }[]
  recommendations: OmsAssistRecommendation[]
}

function priorityRank(priority: OmsAssistPriority) {
  if (priority === 'high') return 0
  if (priority === 'medium') return 1
  return 2
}

export function buildOmsAssist(orders: CommerceOrder[]): OmsAssistResult {
  const now = Date.now()
  const recommendations: OmsAssistRecommendation[] = []
  const carrierMap = new Map<string, string[]>()
  const readyOrders = []
  const purchaseFirstOrders = []
  const deadlineRiskOrders = []

  for (const order of orders) {
    const assessment = assessCommerceOrder(order)
    const hoursToShipBy = (new Date(order.shipBy).getTime() - now) / 36e5

    if (assessment.canImport) readyOrders.push(order)
    if (!assessment.canImport || order.fulfillmentMode === 'purchase_first') purchaseFirstOrders.push(order)
    if (hoursToShipBy <= 24 || order.status === 'overdue_risk') deadlineRiskOrders.push(order)

    if (assessment.canImport) {
      const existing = carrierMap.get(order.carrierPreference) ?? []
      existing.push(order.platformOrderNo)
      carrierMap.set(order.carrierPreference, existing)
    }
  }

  if (deadlineRiskOrders.length > 0) {
    recommendations.push({
      id: 'deadline-risk',
      priority: 'high',
      title: '優先處理出貨時限',
      detail: deadlineRiskOrders
        .map(order => `${PLATFORM_LABELS[order.platform]} ${order.platformOrderNo}`)
        .join('、'),
      orderIds: deadlineRiskOrders.map(order => order.id),
    })
  }

  const blockedOrders = orders.filter(order => !assessCommerceOrder(order).canImport)
  if (blockedOrders.length > 0) {
    recommendations.push({
      id: 'inventory-shortage',
      priority: 'high',
      title: '庫存不足先轉調貨',
      detail: blockedOrders
        .map(order => `${order.platformOrderNo} 有 ${assessCommerceOrder(order).insufficientItems.length} 項不足`)
        .join('；'),
      orderIds: blockedOrders.map(order => order.id),
    })
  }

  if (readyOrders.length > 0) {
    recommendations.push({
      id: 'reserve-ready',
      priority: 'medium',
      title: '可先匯入並預留',
      detail: readyOrders.map(order => order.platformOrderNo).join('、'),
      orderIds: readyOrders.map(order => order.id),
    })
  }

  for (const [carrier, orderNos] of Array.from(carrierMap.entries())) {
    if (orderNos.length > 1) {
      recommendations.push({
        id: `carrier-${carrier}`,
        priority: 'low',
        title: `${carrier} 可批次處理`,
        detail: orderNos.join('、'),
        orderIds: orders
          .filter(order => order.carrierPreference === carrier)
          .map(order => order.id),
      })
    }
  }

  const carrierBatches = Array.from(carrierMap.entries())
    .map(([carrier, orderNos]) => ({ carrier, count: orderNos.length, orderNos }))
    .sort((a, b) => b.count - a.count)

  return {
    readyToImport: readyOrders.length,
    needsPurchase: purchaseFirstOrders.length,
    deadlineRisk: deadlineRiskOrders.length,
    carrierBatches,
    recommendations: recommendations.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)),
  }
}
