/**
 * UPS On-Call Pickup API — 預約提貨
 * API: POST /api/pickupcreation/v2201/pickup
 *
 * UPS 預約流程：
 *   1. 填寫可供提貨的時間窗（readyTime ~ closeTime）
 *   2. 提供聯絡人
 *   3. UPS 回傳 PickupCreationNumber（確認號）
 */

const UPS_PICKUP_URL = 'https://onlinetools.ups.com/api/pickupcreation/v2201/pickup'

export interface UpsPickupRequest {
  accessToken: string
  accountNumber: string

  // 提貨地點
  pickupAddress: {
    companyName: string
    addressLine: string
    city: string
    stateProvinceCode?: string
    postalCode: string
    countryCode: string
    phone: string
    contactName?: string
  }

  // 時間窗（當天，local time HHmm）
  pickupDate: string     // YYYYMMDD
  readyTime: string      // HHmm，e.g. '1400' = 2pm
  closeTime: string      // HHmm，e.g. '1800' = 6pm

  // 貨物描述
  serviceCode: string    // 與提單相同的服務代碼
  totalWeightKg: number
  quantity: number       // 總箱數
  referenceNo?: string   // PI 號
}

export interface UpsPickupResult {
  confirmationNumber: string
  dueDate?: string       // 預計提貨日 YYYYMMDD
  rateStatus?: string
}

export async function scheduleUpsPickup(req: UpsPickupRequest): Promise<UpsPickupResult> {
  const body = {
    PickupCreationRequest: {
      RatePickupIndicator: 'N',  // 不需要實時費率
      Shipper: {
        Account: {
          AccountNumber: req.accountNumber,
          AccountCountryCode: req.pickupAddress.countryCode.toUpperCase(),
        },
      },
      PickupDateInfo: {
        CloseTime: req.closeTime,
        ReadyTime: req.readyTime,
        PickupDate: req.pickupDate,
      },
      PickupAddress: {
        CompanyName: req.pickupAddress.companyName,
        AddressLine: req.pickupAddress.addressLine,
        City: req.pickupAddress.city,
        ...(req.pickupAddress.stateProvinceCode?.trim()
          ? { StateProvince: req.pickupAddress.stateProvinceCode.trim() }
          : {}),
        PostalCode: req.pickupAddress.postalCode,
        CountryCode: req.pickupAddress.countryCode.toUpperCase(),
        ResidentialIndicator: 'N',
        PickupPoint: 'A',  // Front Door
        Phone: {
          Number: req.pickupAddress.phone.replace(/\D/g, '').slice(-10),
        },
      },
      AlternateAddressIndicator: 'N',
      PickupPiece: [
        {
          ServiceCode: req.serviceCode,
          Quantity: String(req.quantity),
          DestinationCountryCode: 'US',  // 主要目的地，後續可參數化
          ContainerCode: '01',           // 一般紙箱
        },
      ],
      TotalWeight: {
        Weight: req.totalWeightKg.toFixed(1),
        UnitOfMeasurement: 'KGS',
      },
      ...(req.referenceNo ? {
        ShipmentDetail: {
          PackageCount: String(req.quantity),
          ShipmentDescription: req.referenceNo,
        },
      } : {}),
      Notification: {
        ConfirmationEmailAddress: '',  // 可選填通知 email
        UndeliverableEmailAddress: '',
      },
    },
  }

  const res = await fetch(UPS_PICKUP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${req.accessToken}`,
      'Content-Type': 'application/json',
      transId: `paxis_pickup_${Date.now()}`,
      transactionSrc: 'paxis',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json() as Record<string, unknown>

  if (!res.ok) {
    const errors = (data as { response?: { errors?: Array<{ message: string }> } }).response?.errors
    const msg = errors?.[0]?.message ?? `UPS Pickup API 錯誤 ${res.status}`
    throw new Error(msg)
  }

  const resp = (data as { PickupCreationResponse?: { PickupCreationNumber?: string; DueDate?: string; RateStatus?: string } }).PickupCreationResponse
  if (!resp) throw new Error('UPS Pickup 回應格式異常')

  return {
    confirmationNumber: resp.PickupCreationNumber ?? '',
    dueDate: resp.DueDate,
    rateStatus: resp.RateStatus,
  }
}
