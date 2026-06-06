/**
 * UPS Shipping API — 建提單（取得 tracking number + label）
 * API: POST /api/shipments/v2403/ship
 */

import type { ShippingAddress, ShippingPackage } from './types'

const UPS_SHIP_URL = 'https://onlinetools.ups.com/api/shipments/v2403/ship'

export interface UpsShipmentRequest {
  accessToken: string
  accountNumber: string
  serviceCode: string          // e.g. '07' = UPS Worldwide Express
  shipper: ShippingAddress
  shipTo: ShippingAddress
  packages: ShippingPackage[]
  declaredValue?: number
  declaredCurrency?: string
  labelFormat?: 'GIF' | 'PNG' | 'PDF'   // default GIF
  referenceNo?: string                   // PI 號或其他參考號
}

export interface UpsShipmentResult {
  trackingNumber: string
  shipmentIdentificationNumber: string
  labelBase64: string          // 第一個 label 的 GraphicImage
  labelFormat: string
  chargedAmount?: number
  chargedCurrency?: string
  allLabels: Array<{ trackingNumber: string; labelBase64: string }>
}

export async function createUpsShipment(req: UpsShipmentRequest): Promise<UpsShipmentResult> {
  const labelType = req.labelFormat ?? 'GIF'

  const packages = req.packages.flatMap(p =>
    Array(Math.max(1, p.quantity ?? 1)).fill(null).map(() => {
      const pkg: Record<string, unknown> = {
        Packaging: { Code: p.packageType === 'document' ? '01' : '02' },
        PackageWeight: {
          UnitOfMeasurement: { Code: 'KGS' },
          Weight: Math.max(0.1, p.weightKg).toFixed(2),
        },
      }
      if (p.dimensions && p.packageType !== 'document') {
        pkg.Dimensions = {
          UnitOfMeasurement: { Code: 'CM' },
          Length: p.dimensions.lengthCm.toFixed(1),
          Width: p.dimensions.widthCm.toFixed(1),
          Height: p.dimensions.heightCm.toFixed(1),
        }
      }
      return pkg
    })
  )

  const body = {
    ShipmentRequest: {
      Request: {
        RequestOption: 'nonvalidate',
        TransactionReference: { CustomerContext: req.referenceNo ?? `paxis_${Date.now()}` },
      },
      Shipment: {
        Description: req.referenceNo ?? 'PAXIS Shipment',
        Shipper: {
          Name: req.shipper.name,
          ShipperNumber: req.accountNumber,
          ...(req.shipper.taxId?.trim() ? { TaxIdentificationNumber: req.shipper.taxId } : {}),
          Address: {
            AddressLine: req.shipper.addressLine || undefined,
            City: req.shipper.city,
            PostalCode: req.shipper.postalCode,
            CountryCode: req.shipper.countryCode.toUpperCase(),
          },
        },
        ShipTo: {
          Name: req.shipTo.name,
          ...(req.shipTo.taxId?.trim() ? { TaxIdentificationNumber: req.shipTo.taxId } : {}),
          Address: {
            AddressLine: req.shipTo.addressLine || undefined,
            City: req.shipTo.city,
            ...(req.shipTo.stateProvinceCode?.trim() ? { StateProvinceCode: req.shipTo.stateProvinceCode.trim() } : {}),
            PostalCode: req.shipTo.postalCode,
            CountryCode: req.shipTo.countryCode.toUpperCase(),
          },
        },
        ShipFrom: {
          Name: req.shipper.name,
          Address: {
            AddressLine: req.shipper.addressLine || undefined,
            City: req.shipper.city,
            PostalCode: req.shipper.postalCode,
            CountryCode: req.shipper.countryCode.toUpperCase(),
          },
        },
        PaymentInformation: {
          ShipmentCharge: {
            Type: '01',
            BillShipper: { AccountNumber: req.accountNumber },
          },
        },
        Service: { Code: req.serviceCode },
        ...(req.declaredValue ? {
          InvoiceLineTotal: {
            CurrencyCode: req.declaredCurrency ?? 'USD',
            MonetaryValue: req.declaredValue.toFixed(2),
          },
        } : {}),
        ...(req.referenceNo ? {
          ReferenceNumber: { Value: req.referenceNo, BarCodeIndicator: '' },
        } : {}),
        Package: packages,
      },
      LabelSpecification: {
        LabelImageFormat: { Code: labelType },
        LabelStockSize: { Height: '6', Width: '4' },
      },
    },
  }

  const res = await fetch(UPS_SHIP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${req.accessToken}`,
      'Content-Type': 'application/json',
      transId: `paxis_${Date.now()}`,
      transactionSrc: 'paxis',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json() as Record<string, unknown>

  if (!res.ok) {
    const errors = (data as { response?: { errors?: Array<{ message: string }> } }).response?.errors
    const msg = errors?.[0]?.message ?? `UPS Shipping API 錯誤 ${res.status}`
    throw new Error(msg)
  }

  const resp = (data as { ShipmentResponse?: { ShipmentResults?: Record<string, unknown> } }).ShipmentResponse?.ShipmentResults
  if (!resp) throw new Error('UPS 回應格式異常')

  const shipId = (resp as { ShipmentIdentificationNumber?: string }).ShipmentIdentificationNumber ?? ''

  // 處理多個 package labels
  const pkgResults = Array.isArray((resp as { PackageResults?: unknown }).PackageResults)
    ? (resp as { PackageResults: Array<{ TrackingNumber: string; ShippingLabel: { GraphicImage: string } }> }).PackageResults
    : [(resp as { PackageResults: { TrackingNumber: string; ShippingLabel: { GraphicImage: string } } }).PackageResults]

  const allLabels = pkgResults.filter(Boolean).map(p => ({
    trackingNumber: p.TrackingNumber,
    labelBase64: p.ShippingLabel?.GraphicImage ?? '',
  }))

  const firstLabel = allLabels[0]

  const charges = (resp as { ShipmentCharges?: { TotalCharges?: { MonetaryValue?: string; CurrencyCode?: string } } }).ShipmentCharges?.TotalCharges
  const negotiated = (resp as { NegotiatedRateCharges?: { TotalCharge?: { MonetaryValue?: string; CurrencyCode?: string } } }).NegotiatedRateCharges?.TotalCharge

  const chargedAmount = negotiated?.MonetaryValue
    ? parseFloat(negotiated.MonetaryValue)
    : charges?.MonetaryValue ? parseFloat(charges.MonetaryValue) : undefined
  const chargedCurrency = negotiated?.CurrencyCode ?? charges?.CurrencyCode

  return {
    trackingNumber: firstLabel?.trackingNumber ?? shipId,
    shipmentIdentificationNumber: shipId,
    labelBase64: firstLabel?.labelBase64 ?? '',
    labelFormat: labelType,
    chargedAmount,
    chargedCurrency,
    allLabels,
  }
}
