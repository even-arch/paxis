/**
 * 統一運送選項介面
 * 不論底層是 UPS、FedEx 還是其他 carrier，上層一律看這個結構。
 */
export interface UnifiedShippingOption {
  carrierCode: string        // 'ups' | 'fedex' | ...
  carrierName: string
  serviceCode: string        // carrier 原始服務代碼
  serviceName: string
  deliveryTier: 'economy' | 'standard' | 'express' | 'premium' | 'freight'
  estimatedDaysMin: number | null
  estimatedDaysMax: number | null
  amount: number             // 實際收費（有議價則為議價後）
  listAmount: number         // 官方定價
  isNegotiated: boolean
  currency: string
  guaranteedDelivery: boolean
  chargeBreakdown: ShippingChargeBreakdown | null
  /** API 報價 × 折扣係數。Admin 未設定則為 null。 */
  contractEstimate: number | null
}

export interface ShippingChargeBreakdown {
  baseCharge: number | null
  surcharges: Array<{ code: string; label: string; amount: number }>
  taxAmount: number | null
  totalWithTax: number | null
  currency: string
}

export interface ShippingAddress {
  name: string
  addressLine: string
  city: string
  stateProvinceCode?: string
  postalCode: string
  countryCode: string  // ISO 2-letter, e.g. 'TW', 'US'
  taxId?: string       // 統編 / Business Number（UPS 用於 business discount 識別）
}

export interface ShippingPackage {
  weightKg: number
  dimensions?: { lengthCm: number; widthCm: number; heightCm: number }
  packageType?: 'package' | 'document'
  quantity?: number
}

export interface GetRatesInput {
  origin: ShippingAddress
  destination: ShippingAddress
  packages: ShippingPackage[]
  declaredValueUsd?: number
}
