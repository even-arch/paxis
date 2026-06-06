/**
 * UPS Rating API client（改編自 Patisco ups-rating.client.ts）
 * 用 /Shop 一次拿所有可用服務的報價。
 */

import type { ShippingAddress, ShippingPackage, UnifiedShippingOption, ShippingChargeBreakdown } from './types'

const UPS_RATING_URL = 'https://onlinetools.ups.com/api/rating/v2403/Shop'

// ─── UPS service code → 名稱 + tier ─────────────────────────────────────────

const SERVICE_MAP: Record<string, { name: string; tier: UnifiedShippingOption['deliveryTier']; daysMin: number | null; daysMax: number | null }> = {
  '65': { name: 'UPS Worldwide Saver',          tier: 'standard', daysMin: 3,  daysMax: 5  },
  '08': { name: 'UPS Worldwide Expedited',       tier: 'economy',  daysMin: 5,  daysMax: 8  },
  '11': { name: 'UPS Standard',                  tier: 'economy',  daysMin: 5,  daysMax: 10 },
  '07': { name: 'UPS Worldwide Express',         tier: 'express',  daysMin: 1,  daysMax: 3  },
  '54': { name: 'UPS Worldwide Express Plus',    tier: 'premium',  daysMin: 1,  daysMax: 2  },
  '96': { name: 'UPS Worldwide Express Freight', tier: 'freight',  daysMin: 3,  daysMax: 5  },
  '03': { name: 'UPS Ground',                    tier: 'economy',  daysMin: 3,  daysMax: 7  },
  '12': { name: 'UPS 3 Day Select',              tier: 'standard', daysMin: 3,  daysMax: 3  },
  '02': { name: 'UPS 2nd Day Air',               tier: 'express',  daysMin: 2,  daysMax: 2  },
  '01': { name: 'UPS Next Day Air',              tier: 'premium',  daysMin: 1,  daysMax: 1  },
  '13': { name: 'UPS Next Day Air Saver',        tier: 'premium',  daysMin: 1,  daysMax: 1  },
  '14': { name: 'UPS Next Day Air Early AM',     tier: 'premium',  daysMin: 1,  daysMax: 1  },
}

const SURCHARGE_NAMES: Record<string, string> = {
  '375': '燃油附加費',
  '100': '偏遠地區附加費',
  '190': '特殊搬運費',
  '270': '住宅配送費',
  '370': '旺季附加費',
  '380': '旺季附加費（小件）',
  '430': '超大包裹費',
}

// ─── API response types ──────────────────────────────────────────────────────

interface UpsApiCharge {
  Code: string
  CurrencyCode: string
  MonetaryValue: string
  SubType?: string
}

interface UpsApiRatedShipment {
  Service: { Code: string }
  TotalCharges: { MonetaryValue: string; CurrencyCode: string }
  TotalChargesWithTaxes?: { MonetaryValue: string; CurrencyCode: string }
  TransportationCharges?: { MonetaryValue: string; CurrencyCode: string }
  ItemizedCharges?: UpsApiCharge[]
  TaxCharges?: Array<{ Type: string; MonetaryValue: string; CurrencyCode: string }>
  NegotiatedRateCharges?: {
    TotalCharge: { MonetaryValue: string; CurrencyCode: string }
    BaseServiceCharge?: { MonetaryValue: string; CurrencyCode: string }
    ItemizedCharges?: UpsApiCharge[]
    TaxCharges?: Array<{ Type: string; MonetaryValue: string }>
    TotalChargesWithTaxes?: { MonetaryValue: string; CurrencyCode: string }
  }
  BillingWeight?: { Weight: string }
  GuaranteedDelivery?: { BusinessDaysInTransit?: string }
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function buildBreakdown(s: UpsApiRatedShipment, isNeg: boolean): ShippingChargeBreakdown | null {
  const neg = isNeg ? s.NegotiatedRateCharges : undefined
  const currency = neg?.TotalCharge.CurrencyCode ?? s.TotalCharges.CurrencyCode

  const baseCharge = neg?.BaseServiceCharge
    ? parseFloat(neg.BaseServiceCharge.MonetaryValue)
    : s.TransportationCharges ? parseFloat(s.TransportationCharges.MonetaryValue) : null

  const rawSurcharges = neg?.ItemizedCharges ?? s.ItemizedCharges ?? []
  const surcharges = rawSurcharges.map(c => ({
    code: c.Code,
    label: SURCHARGE_NAMES[c.Code] ?? c.SubType ?? `附加費 ${c.Code}`,
    amount: parseFloat(c.MonetaryValue),
  }))

  const rawTax = neg?.TaxCharges ?? s.TaxCharges ?? []
  const taxAmount = rawTax.length > 0
    ? rawTax.reduce((acc, t) => acc + parseFloat(t.MonetaryValue), 0)
    : null

  const totalWithTaxRaw = neg?.TotalChargesWithTaxes ?? s.TotalChargesWithTaxes
  const totalWithTax = totalWithTaxRaw ? parseFloat(totalWithTaxRaw.MonetaryValue) : null

  if (baseCharge === null && surcharges.length === 0 && taxAmount === null) return null
  return { baseCharge, surcharges, taxAmount, totalWithTax, currency }
}

function buildUpsAddress(addr: ShippingAddress, shipperNumber?: string) {
  return {
    Name: addr.name,
    ...(shipperNumber ? { ShipperNumber: shipperNumber } : {}),
    ...(addr.taxId?.trim() ? { TaxIdentificationNumber: addr.taxId.trim() } : {}),
    Address: {
      ...(addr.addressLine ? { AddressLine: addr.addressLine } : {}),
      City: addr.city,
      ...(addr.stateProvinceCode?.trim() ? { StateProvinceCode: addr.stateProvinceCode.trim() } : {}),
      PostalCode: addr.postalCode,
      CountryCode: addr.countryCode.toUpperCase(),
    },
  }
}

function buildPackages(pkgs: ShippingPackage[]) {
  // 展開 quantity，超過 50 件時合併
  const expanded: ShippingPackage[] = pkgs.flatMap(p =>
    Array(Math.max(1, p.quantity ?? 1)).fill({ ...p, quantity: 1 })
  )
  const list = expanded.length > 50 ? [{ weightKg: expanded.reduce((s, p) => s + p.weightKg, 0) / expanded.length, quantity: 1 }] : expanded

  return list.map(pkg => {
    const p: Record<string, unknown> = {
      PackagingType: { Code: pkg.packageType === 'document' ? '01' : '02' },
      PackageWeight: {
        UnitOfMeasurement: { Code: 'KGS' },
        Weight: Math.max(0.1, pkg.weightKg).toFixed(2),
      },
    }
    if (pkg.dimensions && pkg.packageType !== 'document') {
      p.Dimensions = {
        UnitOfMeasurement: { Code: 'CM' },
        Length: pkg.dimensions.lengthCm.toFixed(1),
        Width: pkg.dimensions.widthCm.toFixed(1),
        Height: pkg.dimensions.heightCm.toFixed(1),
      }
    }
    return p
  })
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function getUpsRates(
  accessToken: string,
  accountNumber: string,
  origin: ShippingAddress,
  destination: ShippingAddress,
  packages: ShippingPackage[],
  declaredValueUsd?: number,
): Promise<UnifiedShippingOption[]> {
  const body = {
    RateRequest: {
      Request: {
        RequestOption: 'Shop',
        TransactionReference: { CustomerContext: `paxis_${Date.now()}` },
      },
      Shipment: {
        Shipper: buildUpsAddress(origin, accountNumber),
        ShipTo: buildUpsAddress(destination),
        ShipFrom: buildUpsAddress(origin),
        ShipmentRatingOptions: { NegotiatedRatesIndicator: '' },
        PaymentDetails: {
          ShipmentCharge: {
            Type: '01',
            BillShipper: { AccountNumber: accountNumber },
          },
        },
        ...(declaredValueUsd ? {
          InvoiceLineTotal: {
            CurrencyCode: 'USD',
            MonetaryValue: declaredValueUsd.toFixed(2),
          },
        } : {}),
        Package: buildPackages(packages),
      },
    },
  }

  const res = await fetch(UPS_RATING_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      transId: `paxis_${Date.now()}`,
      transactionSrc: 'paxis',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json() as Record<string, unknown>

  if (!res.ok) {
    const errors = (data as any)?.response?.errors
    const msg = errors?.[0]?.message ?? `UPS Rating API 錯誤 ${res.status}`
    throw new Error(msg)
  }

  const shipments: UpsApiRatedShipment[] = (data as any)?.RateResponse?.RatedShipment ?? []

  const options: UnifiedShippingOption[] = shipments.map(s => {
    const listPrice = parseFloat(s.TotalCharges.MonetaryValue)
    const negPrice = s.NegotiatedRateCharges?.TotalCharge
      ? parseFloat(s.NegotiatedRateCharges.TotalCharge.MonetaryValue)
      : null
    const isNeg = negPrice !== null && negPrice < listPrice
    const amount = isNeg ? negPrice! : listPrice
    const currency = s.NegotiatedRateCharges?.TotalCharge?.CurrencyCode ?? s.TotalCharges.CurrencyCode

    const svc = SERVICE_MAP[s.Service.Code]
    const transitDays = s.GuaranteedDelivery?.BusinessDaysInTransit
      ? parseInt(s.GuaranteedDelivery.BusinessDaysInTransit, 10)
      : null

    return {
      carrierCode: 'ups',
      carrierName: 'UPS',
      serviceCode: s.Service.Code,
      serviceName: svc?.name ?? `UPS Service ${s.Service.Code}`,
      deliveryTier: svc?.tier ?? 'standard',
      estimatedDaysMin: transitDays ?? svc?.daysMin ?? null,
      estimatedDaysMax: transitDays ?? svc?.daysMax ?? null,
      amount,
      listAmount: listPrice,
      isNegotiated: isNeg,
      currency,
      guaranteedDelivery: !!s.GuaranteedDelivery?.BusinessDaysInTransit,
      chargeBreakdown: buildBreakdown(s, isNeg),
      contractEstimate: null, // 由呼叫端套用 discountMultiplier
    }
  })

  return options.sort((a, b) => a.amount - b.amount)
}
