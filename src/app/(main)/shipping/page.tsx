'use client'

import { useState, useCallback, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Address {
  name: string
  addressLine: string
  city: string
  stateProvinceCode: string
  postalCode: string
  countryCode: string
  taxId: string   // 統編 / Business Number
}

interface PackageItem {
  sku: string
  modelNo: string
  desc: string
  specification: string
  qty: string
  unitPrice: string
  unit: string
  currencyCode: string
}

interface Package {
  grossWeightKg: string   // 毛重（計費用）
  netWeightKg: string     // 淨重（報關用）
  lengthCm: string
  widthCm: string
  heightCm: string
  cbmStr: string          // 材積（m³），自動算或手動填
  cftStr: string          // 材積（ft³），與 cbmStr 互算
  quantity: string
  dimsFromCbm?: boolean   // L/W/H 是否由 CBM 倒算
  packageType: 'package' | 'document'
  items: PackageItem[]    // 裝箱內容物
}

interface ShippingOption {
  carrierCode: string
  carrierName: string
  serviceCode: string
  serviceName: string
  deliveryTier: string
  estimatedDaysMin: number | null
  estimatedDaysMax: number | null
  amount: number
  listAmount: number
  isNegotiated: boolean
  contractEstimate: number | null
  currency: string
  guaranteedDelivery: boolean
  chargeBreakdown: {
    baseCharge: number | null
    surcharges: Array<{ code: string; label: string; amount: number }>
    taxAmount: number | null
    currency: string
  } | null
}

interface PiItem {
  slsItemId: number
  sku: string
  modelNo: string
  name: string
  specification: string
  quantity: number
  unitPrice: number
  unit: string
  currencyCode: string
}

interface PiSummary {
  id: number
  piNo: string
  orderId: number
  customerName: string | null
  totalAmount: number | null
  currencyCode: string
  customerAddress: string | null
  customerCity: string | null
  customerCountry: string | null
  customerPostal: string | null
  customerTaxId: string | null
  items: PiItem[]
}

interface Contact {
  id: number
  name: string
  address: string | null
  city: string | null
  countryCode: string | null
  postalCode: string | null
  taxId: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ORIGIN_DEFAULT: Address = {
  name: '錫諾系統股份有限公司',
  addressLine: '',
  city: 'Taipei',
  stateProvinceCode: '',
  postalCode: '100',
  countryCode: 'TW',
  taxId: '',
}

const TIER_STYLE: Record<string, { label: string; cls: string }> = {
  economy:  { label: '經濟', cls: 'bg-gray-100 text-gray-700' },
  standard: { label: '標準', cls: 'bg-blue-100 text-blue-700' },
  express:  { label: '快速', cls: 'bg-orange-100 text-orange-700' },
  premium:  { label: '優先', cls: 'bg-purple-100 text-purple-700' },
  freight:  { label: '貨運', cls: 'bg-red-100 text-red-700' },
}

const CBM_TO_CFT = 35.3147

const emptyPackageItem = (): PackageItem => ({
  sku: '', modelNo: '', desc: '', specification: '',
  qty: '1', unitPrice: '', unit: 'PC', currencyCode: 'USD',
})

const emptyPackage = (): Package => ({
  grossWeightKg: '',
  netWeightKg: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  cbmStr: '',
  cftStr: '',
  quantity: '1',
  packageType: 'package',
  items: [emptyPackageItem()],
})

// ─── Sub-components ───────────────────────────────────────────────────────────

function AddressBlock({
  title, value, onChange, onPickSupplier, onPickCustomer,
}: {
  title: string
  value: Address
  onChange: (v: Address) => void
  onPickSupplier?: () => void
  onPickCustomer?: () => void
}) {
  const set = (f: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [f]: e.target.value })

  return (
    <div className="space-y-3">
      {title && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">{title}</h3>
          <div className="flex gap-2">
            {onPickSupplier && (
              <button type="button" onClick={onPickSupplier}
                className="text-xs text-blue-600 hover:underline">從供應商帶入</button>
            )}
            {onPickCustomer && (
              <button type="button" onClick={onPickCustomer}
                className="text-xs text-blue-600 hover:underline">從客戶帶入</button>
            )}
          </div>
        </div>
      )}
      <div className="grid gap-2">
        <input value={value.name} onChange={set('name')} placeholder="姓名／公司"
          className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <input value={value.addressLine} onChange={set('addressLine')} placeholder="街道地址"
          className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <div className="grid grid-cols-2 gap-2">
          <input value={value.city} onChange={set('city')} placeholder="城市"
            className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <input value={value.stateProvinceCode} onChange={set('stateProvinceCode')} placeholder="州／省（選填）"
            maxLength={3}
            className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={value.postalCode} onChange={set('postalCode')} placeholder="郵遞區號"
            className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <input value={value.countryCode} onChange={set('countryCode')} placeholder="國家碼（TW/US…）"
            maxLength={2}
            className="border rounded px-2 py-1.5 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div>
          <input value={value.taxId} onChange={set('taxId')}
            placeholder="統編 / Business Number（選填，UPS 用於 business discount）"
            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>
    </div>
  )
}

// ─── Contact picker modal ─────────────────────────────────────────────────────

function ContactPicker({
  type, onSelect, onClose,
}: {
  type: 'supplier' | 'customer'
  onSelect: (c: Contact) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const url = type === 'supplier'
        ? `/api/suppliers?search=${encodeURIComponent(query)}&limit=10`
        : `/api/customers?search=${encodeURIComponent(query)}&limit=10`
      const res = await fetch(url)
      const data = await res.json()
      setResults(data.suppliers ?? data.customers ?? [])
    } finally {
      setLoading(false)
    }
  }, [type])

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-medium text-sm">選擇{type === 'supplier' ? '供應商' : '客戶'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search(q)}
              placeholder="搜尋名稱…"
              className="flex-1 border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <button onClick={() => search(q)}
              className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">
              搜尋
            </button>
          </div>
          {loading && <p className="text-xs text-gray-400 text-center py-2">搜尋中…</p>}
          {results.length > 0 && (
            <div className="divide-y max-h-60 overflow-y-auto">
              {results.map(c => (
                <button key={c.id} type="button" onClick={() => onSelect(c)}
                  className="w-full text-left px-2 py-2 hover:bg-blue-50 transition-colors">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-gray-400">
                    {[c.address, c.city, c.countryCode].filter(Boolean).join(', ')}
                  </p>
                </button>
              ))}
            </div>
          )}
          {!loading && results.length === 0 && q && (
            <p className="text-xs text-gray-400 text-center py-2">無結果</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ShippingPage() {
  // Import from PI
  const [piList, setPiList] = useState<PiSummary[]>([])
  const [piLoading, setPiLoading] = useState(false)
  const [piLoaded, setPiLoaded] = useState(false)
  const [selectedPiId, setSelectedPiId] = useState<number | null>(null)

  // Packages
  const [packages, setPackages] = useState<Package[]>([emptyPackage()])

  // Addresses
  const [origin, setOrigin] = useState<Address>(ORIGIN_DEFAULT)
  const [destination, setDestination] = useState<Address>({
    name: '', addressLine: '', city: '', stateProvinceCode: '', postalCode: '', countryCode: '', taxId: '',
  })

  // AI parse
  const [aiParsing, setAiParsing] = useState(false)
  const [aiError, setAiError] = useState('')

  // Declared value
  const [declaredValue, setDeclaredValue] = useState('')
  const [declaredCurrency, setDeclaredCurrency] = useState('USD')

  // Contact picker
  const [picker, setPicker] = useState<{ field: 'origin' | 'destination'; type: 'supplier' | 'customer' } | null>(null)

  // Results
  const [options, setOptions] = useState<ShippingOption[] | null>(null)
  const [discountMultiplier, setDiscountMultiplier] = useState<number | null>(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryError, setQueryError] = useState('')
  const [expandedBreakdown, setExpandedBreakdown] = useState<string | null>(null)

  // 選擇服務（不會立即建提單）
  const [selectedOption, setSelectedOption] = useState<ShippingOption | null>(null)

  // 出貨方式：pickup = 預約提貨，dropoff = 自送 UPS 轉運站
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'dropoff' | null>(null)
  const [pickupDate, setPickupDate] = useState('')
  const [pickupReady, setPickupReady] = useState('1400')
  const [pickupClose, setPickupClose] = useState('1800')
  const [pickupPhone, setPickupPhone] = useState('')

  // 從 Excel 帶入的寄件方名稱（可能是供應商）
  const [excelShipperName, setExcelShipperName] = useState<string | null>(null)

  // Save to PAXIS
  const [paxisSaving, setPaxisSaving] = useState(false)
  const [paxisSaved, setPaxisSaved] = useState<{ shipmentNo: string; shipmentId: number } | null>(null)
  const [paxisError, setPaxisError] = useState('')
  const [paxisActualShipDate, setPaxisActualShipDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [paxisPackingListNo, setPaxisPackingListNo] = useState('')
  const [paxisCommercialInvNo, setPaxisCommercialInvNo] = useState('')

  // 建提單（確認後才執行）
  const [creatingShipment, setCreatingShipment] = useState(false)
  const [shipmentResult, setShipmentResult] = useState<{
    trackingNumber: string; labelBase64: string; labelFormat: string
    chargedAmount?: number; chargedCurrency?: string; logId: number
    pickupConfirmation?: string; pickupDueDate?: string
    allLabels?: Array<{ trackingNumber: string; labelBase64: string }>
  } | null>(null)
  const [shipmentError, setShipmentError] = useState('')

  // ── 從出貨 Excel 匯入（shipment-import 頁傳來的 sessionStorage 資料）─────────────

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('ups_prefill')
      if (!raw) return
      sessionStorage.removeItem('ups_prefill')
      const d = JSON.parse(raw) as {
        totalCartons: number | null
        totalGrossWeightKg: number | null
        totalCft: number | null
        totalAmount: number | null
        currency: string | null
        soldTo: string | null
        shipperName: string | null
        dimensionsCm: { l: number; w: number; h: number } | null
        recipientAddress: {
          name: string; addressLine: string; city: string
          postalCode: string; countryCode: string
        } | null
        items: Array<{ itemNo: string; description: string; qty: number; unit: string; unitPrice: number | null; currency: string | null }>
      }

      const cartons = d.totalCartons ?? 1
      const weightEach = d.totalGrossWeightKg != null
        ? (d.totalGrossWeightKg / cartons).toFixed(2)
        : ''
      const cftEach = d.totalCft != null
        ? (d.totalCft / cartons).toFixed(3)
        : ''

      const dims = d.dimensionsCm

      // 若沒有明確 L/W/H，但有 ft³ → 反推正方體尺寸（同 handleCftInput 邏輯）
      const backCalcDims = (cft: string): { l: string; w: string; h: string } => {
        const cftNum = parseFloat(cft)
        if (isNaN(cftNum) || cftNum <= 0) return { l: '', w: '', h: '' }
        const cbm = cftNum / CBM_TO_CFT
        const side = Math.cbrt(cbm * 1_000_000)
        return { l: side.toFixed(1), w: side.toFixed(1), h: side.toFixed(1) }
      }

      const newPkgs = Array.from({ length: cartons }, (_, i): Package => {
        const hasDims = dims != null
        const calcDims = (!hasDims && cftEach) ? backCalcDims(cftEach) : null
        const cbmEach = cftEach
          ? (parseFloat(cftEach) / CBM_TO_CFT).toFixed(4)
          : ''
        return ({
        grossWeightKg: weightEach,
        netWeightKg: '',
        lengthCm: hasDims ? String(dims!.l) : (calcDims?.l ?? ''),
        widthCm:  hasDims ? String(dims!.w) : (calcDims?.w ?? ''),
        heightCm: hasDims ? String(dims!.h) : (calcDims?.h ?? ''),
        cbmStr: cbmEach,
        cftStr: cftEach,
        dimsFromCbm: !hasDims && !!cftEach,
        quantity: '1',
        packageType: 'package',
        // 品項只填在第一箱，其餘留空
        items: i === 0 && d.items?.length > 0
          ? d.items.map(it => ({
              sku: it.itemNo,
              modelNo: '',
              desc: it.description || '',
              specification: '',
              qty: String(it.qty),
              unitPrice: it.unitPrice != null ? String(it.unitPrice) : '',
              unit: it.unit || 'PC',
              currencyCode: it.currency || 'EUR',
            }))
          : [emptyPackageItem()],
      })
      })
      setPackages(newPkgs)

      if (d.totalAmount != null) {
        setDeclaredValue(d.totalAmount.toFixed(2))
        setDeclaredCurrency(d.currency || 'EUR')
      }

      // 帶入收件方完整地址
      if (d.recipientAddress) {
        const r = d.recipientAddress
        setDestination({
          name:               r.name        || d.soldTo || '',
          addressLine:        r.addressLine || '',
          city:               r.city        || '',
          stateProvinceCode:  '',
          postalCode:         r.postalCode  || '',
          countryCode:        r.countryCode || '',
          taxId:              '',
        })
      } else if (d.soldTo) {
        setDestination(prev => ({ ...prev, name: prev.name || d.soldTo! }))
      }

      // 若 CI 寄件方不是本公司，顯示提醒 banner
      if (d.shipperName) {
        setExcelShipperName(d.shipperName)
      }
    } catch { /* ignore bad sessionStorage data */ }
  }, [])

  // ── 使用公司地址 ─────────────────────────────────────────────────────────────

  async function useCompanyAddress() {
    try {
      const res = await fetch('/api/settings/company')
      if (!res.ok) return
      const data = await res.json()
      // API 直接回傳 company 物件（非 { company: ... }）
      if (data && (data.nameZh || data.nameEn)) {
        setOrigin({
          name:              data.nameZh    || data.nameEn    || '',
          addressLine:       data.addressZh || data.addressEn || '',
          city:              data.city          || '',
          stateProvinceCode: '',
          postalCode:        data.postalCode    || '',
          countryCode:       data.countryCode   || 'TW',
          taxId:             data.taxId         || '',
        })
      }
    } catch { /* ignore */ }
  }

  // ── Load recent PIs ──────────────────────────────────────────────────────────

  async function loadPis() {
    if (piLoaded) return
    setPiLoading(true)
    try {
      const res = await fetch('/api/shipping/pi-list')
      const data = await res.json()
      setPiList(data.pis ?? [])
      setPiLoaded(true)
    } finally {
      setPiLoading(false)
    }
  }

  function importFromPi(pi: PiSummary) {
    setSelectedPiId(pi.id)
    // 申報金額從品項 qty × unitPrice 加總，不直接用 PI totalAmount
    // （totalAmount 可能含其他費用，品項加總才是實際出貨貨值）
    if (pi.items.length > 0) {
      const total = pi.items.reduce((s, it) => s + (it.unitPrice || 0) * (it.quantity || 0), 0)
      if (total > 0) {
        setDeclaredValue(total.toFixed(2))
        setDeclaredCurrency(pi.items[0]?.currencyCode || pi.currencyCode || 'USD')
      }
    } else if (pi.totalAmount) {
      setDeclaredValue(String(pi.totalAmount))
      setDeclaredCurrency(pi.currencyCode || 'USD')
    }
    if (pi.customerName) {
      setDestination({
        name: pi.customerName,
        addressLine: pi.customerAddress ?? '',
        city: pi.customerCity ?? '',
        stateProvinceCode: '',
        postalCode: pi.customerPostal ?? '',
        countryCode: pi.customerCountry ?? '',
        taxId: pi.customerTaxId ?? '',
      })
    }
    // 把 PI 品項填入第一箱的內容物
    if (pi.items.length > 0) {
      setPackages(prev => {
        const updated = [...prev]
        updated[0] = {
          ...updated[0],
          items: pi.items.map(it => ({
            sku: it.sku,
            modelNo: it.modelNo,
            desc: it.name,
            specification: it.specification,
            qty: String(it.quantity),
            unitPrice: String(it.unitPrice),
            unit: it.unit,
            currencyCode: it.currencyCode,
          })),
        }
        return updated
      })
    }
  }

  async function handleAiParse(file: File) {
    setAiParsing(true)
    setAiError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/ai/parse-shipping', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'AI 解析失敗')

      const d = data.data
      // 套用收件地址
      if (d.recipientName || d.recipientCity) {
        setDestination(prev => ({
          ...prev,
          name: d.recipientName ?? prev.name,
          addressLine: d.recipientAddress ?? prev.addressLine,
          city: d.recipientCity ?? prev.city,
          stateProvinceCode: d.recipientState ?? prev.stateProvinceCode,
          postalCode: d.recipientPostal ?? prev.postalCode,
          countryCode: d.recipientCountry ?? prev.countryCode,
          taxId: d.recipientTaxId ?? prev.taxId,
        }))
      }
      // 套用申報金額
      if (d.declaredValueUsd) { setDeclaredValue(String(d.declaredValueUsd)); setDeclaredCurrency(d.currencyCode ?? 'USD') }
      // 套用品項至第一箱
      if (d.items?.length > 0) {
        setPackages(prev => {
          const updated = [...prev]
          updated[0] = {
            ...updated[0],
            items: d.items.map((it: { sku?: string; modelNo?: string; name?: string; specification?: string; quantity?: number; unitPrice?: number; unit?: string }) => ({
              sku: it.sku ?? '',
              modelNo: it.modelNo ?? '',
              desc: it.name ?? '',
              specification: it.specification ?? '',
              qty: String(it.quantity ?? 1),
              unitPrice: it.unitPrice ? String(it.unitPrice) : '',
              unit: it.unit ?? 'PC',
              currencyCode: d.currencyCode ?? 'USD',
            })),
          }
          return updated
        })
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI 解析失敗')
    } finally {
      setAiParsing(false)
    }
  }

  // ── Packages ─────────────────────────────────────────────────────────────────

  // 選擇服務，進入確認流程（不建提單）
  function handleSelectOption(opt: ShippingOption) {
    setSelectedOption(opt)
    setDeliveryMethod(null)
    setShipmentResult(null)
    setShipmentError('')
    // 預設提貨日為今天
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    setPickupDate(today)
  }

  // 確認出貨：建提單 + 若選預約提貨則同步預約
  async function handleConfirmShipment() {
    if (!selectedOption || !deliveryMethod) return
    setCreatingShipment(true); setShipmentError(''); setShipmentResult(null)
    try {
      const pkgList = packages.filter(p => parseFloat(p.grossWeightKg) > 0)
      const piData = piList.find(p => p.id === selectedPiId)

      // Step 1：建 UPS 提單
      const res = await fetch('/api/shipping/create-shipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceCode: selectedOption.serviceCode,
          serviceName: selectedOption.serviceName,
          origin: { ...origin, taxId: origin.taxId || undefined },
          destination: { ...destination, taxId: destination.taxId || undefined },
          packages: pkgList.map(p => ({
            weightKg: parseFloat(p.grossWeightKg),
            lengthCm: p.lengthCm ? parseFloat(p.lengthCm) : undefined,
            widthCm: p.widthCm ? parseFloat(p.widthCm) : undefined,
            heightCm: p.heightCm ? parseFloat(p.heightCm) : undefined,
            quantity: parseInt(p.quantity) || 1,
            packageType: p.packageType,
            items: p.items,
          })),
          declaredValue: declaredValue ? parseFloat(declaredValue) : undefined,
          declaredCurrency: declaredCurrency || undefined,
          piId: selectedPiId ?? undefined,
          piNo: piData?.piNo ?? undefined,
        }),
      })
      const shipData = await res.json()
      if (!res.ok) throw new Error(shipData.error ?? '建提單失敗')

      let pickupConfirmation: string | undefined
      let pickupDueDate: string | undefined

      // Step 2：若選預約提貨，同步預約
      if (deliveryMethod === 'pickup') {
        const totalWeight = packages.reduce((s, p) =>
          s + (parseFloat(p.grossWeightKg) || 0) * (parseInt(p.quantity) || 1), 0)
        const totalBoxes = packages.reduce((s, p) => s + (parseInt(p.quantity) || 1), 0)

        const pickupRes = await fetch('/api/shipping/schedule-pickup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            logId: shipData.logId,
            pickupDate,
            readyTime: pickupReady,
            closeTime: pickupClose,
            contactPhone: pickupPhone,
            totalWeightKg: totalWeight,
            quantity: totalBoxes,
            serviceCode: selectedOption.serviceCode,
            companyName: origin.name,
            addressLine: origin.addressLine,
            city: origin.city,
            stateProvinceCode: origin.stateProvinceCode || undefined,
            postalCode: origin.postalCode,
            countryCode: origin.countryCode,
          }),
        })
        const pickupData = await pickupRes.json()
        if (pickupRes.ok) {
          pickupConfirmation = pickupData.confirmationNumber
          pickupDueDate = pickupData.dueDate
        } else {
          // 提單已建立，預約失敗不中斷，只記錄錯誤
          console.warn('[shipping] 提單已建立，但預約提貨失敗:', pickupData.error)
          setShipmentError(`提單已建立（${shipData.trackingNumber}），但預約提貨失敗：${pickupData.error ?? '請稍後手動預約'}`)
        }
      }

      setShipmentResult({ ...shipData, pickupConfirmation, pickupDueDate })
    } catch (err) {
      setShipmentError(err instanceof Error ? err.message : '建提單失敗')
    } finally {
      setCreatingShipment(false)
    }
  }

  // ── Save to PAXIS ────────────────────────────────────────────────────────────

  async function handleSaveToPaxis() {
    const pi = piList.find(p => p.id === selectedPiId)
    if (!pi) { setPaxisError('請先選擇一份 PI'); return }
    if (!paxisActualShipDate) { setPaxisError('請填寫實際出貨日'); return }

    setPaxisSaving(true); setPaxisError(''); setPaxisSaved(null)
    try {
      // 整合所有箱子的品項（按 sku 合算數量、毛重、cbm）
      const skuMap: Record<string, { qty: number; gw: number; nw: number; cbm: number; boxes: number }> = {}
      packages.forEach(pkg => {
        const boxes = parseInt(pkg.quantity) || 1
        const gwPerBox = parseFloat(pkg.grossWeightKg) || 0
        const nwPerBox = parseFloat(pkg.netWeightKg) || 0
        const cbmPerBox = parseFloat(pkg.cbmStr) || 0
        pkg.items.forEach(it => {
          const sku = it.sku || it.modelNo
          if (!sku) return
          const qty = (parseFloat(it.qty) || 0) * boxes
          if (!skuMap[sku]) skuMap[sku] = { qty: 0, gw: 0, nw: 0, cbm: 0, boxes: 0 }
          skuMap[sku].qty += qty
          skuMap[sku].gw += gwPerBox * boxes
          skuMap[sku].nw += nwPerBox * boxes
          skuMap[sku].cbm += cbmPerBox * boxes
          skuMap[sku].boxes += boxes
        })
      })

      // 比對 PI 品項的 slsItemId
      const items = pi.items
        .filter(it => it.slsItemId)
        .map(it => {
          const sku = it.sku || it.modelNo
          const packed = skuMap[sku]
          return {
            slsItemId: it.slsItemId,
            quantity: packed?.qty ?? it.quantity,
            cartons: packed?.boxes ?? null,
            grossWeightKg: packed?.gw ?? null,
            netWeightKg: packed?.nw ?? null,
            cbm: packed?.cbm ?? null,
          }
        })

      const res = await fetch(`/api/sales/${pi.orderId}/shipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          piId: pi.id,
          actualShipDate: paxisActualShipDate,
          packingListNo: paxisPackingListNo || null,
          commercialInvNo: paxisCommercialInvNo || null,
          shippingMethod: selectedOption ? `UPS ${selectedOption.serviceName}` : null,
          trackingNo: shipmentResult?.trackingNumber ?? null,
          source: 'UPS',
          items,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '儲存失敗')
      setPaxisSaved({ shipmentNo: data.shipmentNo, shipmentId: data.shipmentId })
    } catch (err) {
      setPaxisError(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setPaxisSaving(false)
    }
  }

  function downloadLabel() {
    if (!shipmentResult?.labelBase64) return
    const fmt = (shipmentResult.labelFormat ?? 'GIF').toLowerCase()
    const mime = fmt === 'pdf' ? 'application/pdf' : `image/${fmt}`
    const url = `data:${mime};base64,${shipmentResult.labelBase64}`
    const a = document.createElement('a')
    a.href = url
    a.download = `UPS_${shipmentResult.trackingNumber}.${fmt}`
    a.click()
  }

  function updatePkg(i: number, field: keyof Package, value: string | boolean | PackageItem[]) {
    setPackages(prev => prev.map((p, idx) => {
      if (idx !== i) return p
      const next = { ...p, [field]: value }

      // 每次改 L/W/H，如果三者都有值，自動算 CBM + CFT
      if (['lengthCm', 'widthCm', 'heightCm'].includes(field as string)) {
        const l = parseFloat(field === 'lengthCm' ? String(value) : p.lengthCm)
        const w = parseFloat(field === 'widthCm'  ? String(value) : p.widthCm)
        const h = parseFloat(field === 'heightCm' ? String(value) : p.heightCm)
        if (!isNaN(l) && !isNaN(w) && !isNaN(h) && l > 0 && w > 0 && h > 0) {
          const cbm = (l * w * h) / 1_000_000
          next.cbmStr = cbm.toFixed(4)
          next.cftStr = (cbm * CBM_TO_CFT).toFixed(3)
          next.dimsFromCbm = false
        }
      }
      return next
    }))
  }

  function addPackage() {
    setPackages(prev => [...prev, emptyPackage()])
  }

  function removePackage(i: number) {
    setPackages(prev => prev.filter((_, idx) => idx !== i))
  }

  // CBM 欄位手動輸入
  function handleCbmInput(i: number, cbmStr: string) {
    const cbm = parseFloat(cbmStr)
    const pkg = packages[i]
    const cftStr = !isNaN(cbm) && cbm > 0 ? (cbm * CBM_TO_CFT).toFixed(3) : ''
    const hasManualDims = !pkg.dimsFromCbm && (pkg.lengthCm || pkg.widthCm || pkg.heightCm)

    if (!isNaN(cbm) && cbm > 0 && !hasManualDims) {
      // 從 CBM 反推正方體尺寸
      const sideCm = Math.cbrt(cbm * 1_000_000)
      setPackages(prev => prev.map((p, idx) => idx === i ? {
        ...p, cbmStr, cftStr,
        lengthCm: sideCm.toFixed(1), widthCm: sideCm.toFixed(1), heightCm: sideCm.toFixed(1),
        dimsFromCbm: true,
      } : p))
    } else {
      setPackages(prev => prev.map((p, idx) => idx === i ? { ...p, cbmStr, cftStr } : p))
    }
  }

  // CFT 欄位手動輸入，換算成 CBM，再走 handleCbmInput 邏輯
  function handleCftInput(i: number, cftStr: string) {
    const cft = parseFloat(cftStr)
    const cbm = !isNaN(cft) && cft > 0 ? cft / CBM_TO_CFT : NaN
    const cbmStr = !isNaN(cbm) ? cbm.toFixed(4) : ''
    const pkg = packages[i]
    const hasManualDims = !pkg.dimsFromCbm && (pkg.lengthCm || pkg.widthCm || pkg.heightCm)

    if (!isNaN(cbm) && !hasManualDims) {
      const sideCm = Math.cbrt(cbm * 1_000_000)
      setPackages(prev => prev.map((p, idx) => idx === i ? {
        ...p, cftStr, cbmStr,
        lengthCm: sideCm.toFixed(1), widthCm: sideCm.toFixed(1), heightCm: sideCm.toFixed(1),
        dimsFromCbm: true,
      } : p))
    } else {
      setPackages(prev => prev.map((p, idx) => idx === i ? { ...p, cftStr, cbmStr } : p))
    }
  }

  function addItem(pkgIdx: number) {
    setPackages(prev => prev.map((p, i) => i === pkgIdx
      ? { ...p, items: [...p.items, emptyPackageItem()] }
      : p))
  }

  function updateItem(pkgIdx: number, itemIdx: number, field: keyof PackageItem, value: string) {
    setPackages(prev => prev.map((p, i) => i === pkgIdx
      ? { ...p, items: p.items.map((it, j) => j === itemIdx ? { ...it, [field]: value } : it) }
      : p))
  }

  function removeItem(pkgIdx: number, itemIdx: number) {
    setPackages(prev => prev.map((p, i) => i === pkgIdx
      ? { ...p, items: p.items.filter((_, j) => j !== itemIdx) }
      : p))
  }

  // ── Address picker callback ──────────────────────────────────────────────────

  function handlePickContact(c: Contact) {
    if (!picker) return
    const addr: Address = {
      name: c.name,
      addressLine: c.address ?? '',
      city: c.city ?? '',
      stateProvinceCode: '',
      postalCode: c.postalCode ?? '',
      countryCode: c.countryCode ?? '',
      taxId: c.taxId ?? '',
    }
    if (picker.field === 'origin') setOrigin(addr)
    else setDestination(addr)
    setPicker(null)
  }

  // ── Query rates ──────────────────────────────────────────────────────────────

  async function handleQuery() {
    setQueryError('')
    setOptions(null)

    const pkgList = packages.filter(p => parseFloat(p.grossWeightKg) > 0)
    if (pkgList.length === 0) { setQueryError('請填寫至少一箱的毛重'); return }
    if (!origin.city || !origin.countryCode) { setQueryError('請填寫發貨地城市和國家碼'); return }
    if (!destination.city || !destination.countryCode) { setQueryError('請填寫收貨地城市和國家碼'); return }

    setQueryLoading(true)
    try {
      const res = await fetch('/api/shipping/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { ...origin, taxId: origin.taxId || undefined },
          destination: { ...destination, taxId: destination.taxId || undefined },
          packages: pkgList.map(p => ({
            weightKg: parseFloat(p.grossWeightKg),
            lengthCm: p.lengthCm ? parseFloat(p.lengthCm) : undefined,
            widthCm:  p.widthCm  ? parseFloat(p.widthCm)  : undefined,
            heightCm: p.heightCm ? parseFloat(p.heightCm) : undefined,
            quantity: parseInt(p.quantity) || 1,
            packageType: p.packageType,
          })),
          declaredValueUsd: declaredValue ? parseFloat(declaredValue) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '查詢失敗')
      setOptions(data.options)
      setDiscountMultiplier(data.discountMultiplier)
    } catch (e: unknown) {
      setQueryError(e instanceof Error ? e.message : '查詢失敗')
    } finally {
      setQueryLoading(false)
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────

  const totalBoxes = packages.reduce((s, p) => s + (parseInt(p.quantity) || 1), 0)
  const totalGw = packages.reduce((s, p) =>
    s + (parseFloat(p.grossWeightKg) || 0) * (parseInt(p.quantity) || 1), 0)
  const totalNw = packages.reduce((s, p) =>
    s + (parseFloat(p.netWeightKg) || 0) * (parseInt(p.quantity) || 1), 0)

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-5 py-6 px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800">UPS 出貨</h1>
      </div>

      {/* ── Section A: 從 PI 匯入 / AI 解析 ── */}
      <div className="bg-white rounded-lg border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">快速帶入</h2>
          <div className="flex items-center gap-3">
            <label className={`text-xs px-2 py-1 rounded border cursor-pointer ${aiParsing ? 'opacity-50 pointer-events-none' : 'text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}>
              {aiParsing ? '⏳ AI 解析中...' : '✨ AI 匯入文件'}
              <input type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAiParse(f); e.target.value = '' }} />
            </label>
            <button type="button" onClick={loadPis}
              className="text-xs text-blue-600 hover:underline">
              {piLoaded ? '重新載入 PI' : '載入近期 PI'}
            </button>
          </div>
        </div>
        {aiError && <p className="text-xs text-red-500">❌ {aiError}</p>}

        {piLoading && <p className="text-xs text-gray-400">載入中…</p>}

        {piLoaded && piList.length === 0 && (
          <p className="text-xs text-gray-400">無資料，請手動填寫下方欄位</p>
        )}

        {piList.length > 0 && (
          <div className="divide-y border rounded-md max-h-48 overflow-y-auto">
            {piList.map(pi => (
              <button key={pi.id} type="button" onClick={() => importFromPi(pi)}
                className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors text-xs ${selectedPiId === pi.id ? 'bg-blue-50' : ''}`}>
                <span className="font-mono font-medium">{pi.piNo}</span>
                <span className="text-gray-500 ml-2">{pi.customerName ?? '—'}</span>
                {pi.totalAmount && (
                  <span className="text-gray-400 ml-2">{pi.currencyCode} {pi.totalAmount.toLocaleString()}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {selectedPiId && (
          <p className="text-xs text-green-600">✅ 已帶入客戶地址與申報金額，可在下方確認或修改</p>
        )}
      </div>

      {/* ── Section B: 箱子資料 ── */}
      <div className="bg-white rounded-lg border p-5 space-y-4">
        <h2 className="text-sm font-medium text-gray-700">裝箱資料</h2>

        <div className="space-y-4">
          {packages.map((pkg, i) => (
            <div key={i} className="border rounded-md p-3 space-y-3 relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">第 {i + 1} 組</span>
                <div className="flex items-center gap-2">
                  <button type="button"
                    onClick={() => updatePkg(i, 'packageType', pkg.packageType === 'document' ? 'package' : 'document')}
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      pkg.packageType === 'document'
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}>
                    {pkg.packageType === 'document' ? '文件信封' : '一般貨物'}
                  </button>
                  {packages.length > 1 && (
                    <button onClick={() => removePackage(i)}
                      className="text-gray-300 hover:text-red-500 text-base leading-none">×</button>
                  )}
                </div>
              </div>

              {/* Weight + quantity */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-500">數量（箱）</label>
                  <input type="number" min={1} value={pkg.quantity}
                    onChange={e => updatePkg(i, 'quantity', e.target.value)}
                    className="mt-1 w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">毛重 GW（kg）</label>
                  <input type="number" min={0} step={0.1} value={pkg.grossWeightKg}
                    onChange={e => updatePkg(i, 'grossWeightKg', e.target.value)}
                    placeholder="0.0"
                    className="mt-1 w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">淨重 NW（kg）</label>
                  <input type="number" min={0} step={0.1} value={pkg.netWeightKg}
                    onChange={e => updatePkg(i, 'netWeightKg', e.target.value)}
                    placeholder="0.0"
                    className="mt-1 w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>

              {/* Dimensions + CBM/CFT */}
              {pkg.packageType !== 'document' && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {(['lengthCm', 'widthCm', 'heightCm'] as const).map((dim) => (
                      <div key={dim}>
                        <label className="text-xs text-gray-500">
                          {dim === 'lengthCm' ? '長' : dim === 'widthCm' ? '寬' : '高'}（cm）
                        </label>
                        <input type="number" min={0} step={0.1}
                          value={pkg[dim]}
                          onChange={e => updatePkg(i, dim, e.target.value)}
                          placeholder="選填"
                          className="mt-1 w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                    ))}
                  </div>

                  {/* CBM / CFT — 自動算或手動填，互相換算 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">
                        材積 CBM（m³）
                        {pkg.lengthCm && pkg.widthCm && pkg.heightCm && (
                          <span className="ml-1 text-green-600">自動計算</span>
                        )}
                      </label>
                      <input type="number" min={0} step={0.0001}
                        value={pkg.cbmStr}
                        onChange={e => handleCbmInput(i, e.target.value)}
                        placeholder="0.0000"
                        readOnly={!!(pkg.lengthCm && pkg.widthCm && pkg.heightCm && !pkg.dimsFromCbm)}
                        className={`mt-1 w-full border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                          pkg.lengthCm && pkg.widthCm && pkg.heightCm && !pkg.dimsFromCbm
                            ? 'bg-gray-50 text-gray-600'
                            : ''
                        }`} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">材積 CFT（ft³）</label>
                      <input type="number" min={0} step={0.001}
                        value={pkg.cftStr}
                        onChange={e => handleCftInput(i, e.target.value)}
                        placeholder="0.000"
                        readOnly={!!(pkg.lengthCm && pkg.widthCm && pkg.heightCm && !pkg.dimsFromCbm)}
                        className={`mt-1 w-full border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                          pkg.lengthCm && pkg.widthCm && pkg.heightCm && !pkg.dimsFromCbm
                            ? 'bg-gray-50 text-gray-600'
                            : ''
                        }`} />
                    </div>
                  </div>

                  {pkg.dimsFromCbm && (
                    <p className="text-xs text-amber-600">⚠ 尺寸由材積反推（假設正方體），可直接修改長寬高</p>
                  )}
                </>
              )}

              {/* 裝箱內容物 */}
              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">裝箱內容物</label>
                  <button type="button" onClick={() => addItem(i)}
                    className="text-xs text-blue-600 hover:underline">+ 新增品項</button>
                </div>
                <div className="space-y-2">
                  {pkg.items.map((it, j) => (
                    <div key={j} className="bg-gray-50 rounded p-2 space-y-1.5">
                      <div className="flex gap-1 items-start">
                        <div className="flex-1 grid grid-cols-2 gap-1">
                          <input value={it.sku} onChange={e => updateItem(i, j, 'sku', e.target.value)}
                            placeholder="SKU / 料號"
                            className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                          <input value={it.modelNo} onChange={e => updateItem(i, j, 'modelNo', e.target.value)}
                            placeholder="型號 Model No."
                            className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                        </div>
                        <button type="button" onClick={() => removeItem(i, j)}
                          className="text-gray-300 hover:text-red-500 text-sm leading-none px-1 mt-1">×</button>
                      </div>
                      <input value={it.desc} onChange={e => updateItem(i, j, 'desc', e.target.value)}
                        placeholder="品名 Description *"
                        className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                      <input value={it.specification} onChange={e => updateItem(i, j, 'specification', e.target.value)}
                        placeholder="規格 Specification"
                        className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                      <div className="grid grid-cols-3 gap-1">
                        <div className="flex gap-1 items-center">
                          <input type="number" min={1} value={it.qty}
                            onChange={e => updateItem(i, j, 'qty', e.target.value)}
                            placeholder="數量"
                            className="w-full border rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                          <input value={it.unit} onChange={e => updateItem(i, j, 'unit', e.target.value)}
                            placeholder="單位"
                            className="w-14 border rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                        </div>
                        <div className="flex gap-1 items-center col-span-2">
                          <input type="number" min={0} step={0.01} value={it.unitPrice}
                            onChange={e => updateItem(i, j, 'unitPrice', e.target.value)}
                            placeholder="單價"
                            className="flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                          <input value={it.currencyCode} onChange={e => updateItem(i, j, 'currencyCode', e.target.value)}
                            placeholder="幣別"
                            className="w-14 border rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={addPackage}
          className="text-xs text-blue-600 hover:underline">+ 新增一組</button>

        {/* Summary */}
        <div className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2 flex gap-4">
          <span>共 <strong>{totalBoxes}</strong> 箱</span>
          <span>總毛重 <strong>{totalGw.toFixed(2)} kg</strong></span>
          {totalNw > 0 && <span>總淨重 <strong>{totalNw.toFixed(2)} kg</strong></span>}
        </div>
      </div>

      {/* ── Section C: 地址 ── */}
      <div className="bg-white rounded-lg border p-5 space-y-5">
        <h2 className="text-sm font-medium text-gray-700">地址</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">發貨地（Shipper）</h3>
            <div className="flex gap-2">
              <button type="button" onClick={useCompanyAddress}
                className="text-xs text-green-600 hover:underline">使用公司地址</button>
              <button type="button" onClick={() => setPicker({ field: 'origin', type: 'supplier' })}
                className="text-xs text-blue-600 hover:underline">從供應商帶入</button>
            </div>
          </div>
          {/* 若 Excel 寄件方不是本公司，提醒確認 */}
          {excelShipperName && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-800">
              <span className="mt-0.5">⚠️</span>
              <span>
                出貨文件上的寄件方為 <strong>{excelShipperName}</strong>。
                若此批貨由供應商直送客戶，請按「從供應商帶入」填入實際寄件地址；
                若由本公司出貨，按「使用公司地址」即可。
              </span>
              <button type="button" onClick={() => setExcelShipperName(null)}
                className="ml-auto text-amber-400 hover:text-amber-700 shrink-0">✕</button>
            </div>
          )}
          <AddressBlock title="" value={origin} onChange={setOrigin} />
        </div>
        <div className="border-t pt-4">
          <AddressBlock
            title="收貨地（Ship To）"
            value={destination}
            onChange={setDestination}
            onPickCustomer={() => setPicker({ field: 'destination', type: 'customer' })}
            onPickSupplier={() => setPicker({ field: 'destination', type: 'supplier' })}
          />
        </div>
      </div>

      {/* ── Section D: 報關金額 ── */}
      <div className="bg-white rounded-lg border p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-3">報關申報金額（選填）</h2>
        {/* 從品項算出的小計（僅供參考，可手動修改） */}
        {(() => {
          const byCurrency: Record<string, number> = {}
          packages.forEach(pkg => {
            pkg.items.forEach(it => {
              const qty = parseFloat(it.qty) || 0
              const price = parseFloat(it.unitPrice) || 0
              const cur = it.currencyCode || 'USD'
              if (qty > 0 && price > 0) {
                byCurrency[cur] = (byCurrency[cur] ?? 0) + qty * price
              }
            })
          })
          const entries = Object.entries(byCurrency)
          if (entries.length === 0) return null
          return (
            <div className="mb-3 bg-gray-50 rounded p-2 text-xs text-gray-600 space-y-0.5">
              <p className="font-medium text-gray-700 mb-1">品項加總（qty × 單價）：</p>
              {entries.map(([cur, total]) => (
                <p key={cur} className="font-mono">
                  {cur} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <button type="button"
                    onClick={() => { setDeclaredValue(total.toFixed(2)); setDeclaredCurrency(cur) }}
                    className="ml-2 text-blue-500 hover:underline not-italic">套用</button>
                </p>
              ))}
            </div>
          )
        })()}
        <div className="flex items-center gap-2">
          <div>
            <label className="text-xs text-gray-500">申報金額</label>
            <input type="number" min={0} step={0.01} value={declaredValue}
              onChange={e => setDeclaredValue(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-32 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500">幣別</label>
            <input value={declaredCurrency} onChange={e => setDeclaredCurrency(e.target.value.toUpperCase())}
              maxLength={3} placeholder="USD"
              className="mt-1 w-20 border rounded px-2 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase" />
          </div>
        </div>
      </div>

      {/* ── Query button ── */}
      {queryError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          ❌ {queryError}
        </div>
      )}
      <button onClick={handleQuery} disabled={queryLoading}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
        {queryLoading ? '查詢中…' : '查詢 UPS 運費'}
      </button>

      {/* ── Section E: Results ── */}
      {options && options.length === 0 && (
        <div className="bg-white rounded-lg border p-5 text-sm text-gray-500 text-center">
          無可用方案，請確認地址後重試
        </div>
      )}

      {options && options.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">可用方案</h2>
          </div>

          {options.map((opt, idx) => {
            const tier = TIER_STYLE[opt.deliveryTier] ?? TIER_STYLE.standard
            const key = `${opt.serviceCode}-${idx}`
            const daysLabel = opt.estimatedDaysMin != null && opt.estimatedDaysMax != null
              ? opt.estimatedDaysMin === opt.estimatedDaysMax
                ? `${opt.estimatedDaysMin} 天`
                : `${opt.estimatedDaysMin}–${opt.estimatedDaysMax} 天`
              : '—'

            return (
              <div key={key} className="bg-white rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${tier.cls}`}>{tier.label}</span>
                      {opt.isNegotiated && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">帳號優惠</span>
                      )}
                      <span className="text-sm font-medium">{opt.serviceName}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.carrierName} · {opt.serviceCode} · {daysLabel}</p>
                  </div>

                  <div className="text-right shrink-0">
                    {opt.contractEstimate != null ? (
                      <>
                        <p className="text-lg font-bold text-green-700">
                          <span className="text-sm font-normal mr-1">{opt.currency}</span>
                          {opt.contractEstimate.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-gray-400 line-through">
                          {opt.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      </>
                    ) : (
                      <p className="text-lg font-bold">
                        <span className="text-sm font-normal text-gray-500 mr-1">{opt.currency}</span>
                        {opt.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    )}
                  </div>
                </div>

                {/* 選擇服務按鈕 */}
                <div className="flex justify-end">
                  <button type="button"
                    onClick={() => handleSelectOption(opt)}
                    disabled={!!shipmentResult}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                      selectedOption?.serviceCode === opt.serviceCode
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                    } disabled:opacity-40`}>
                    {selectedOption?.serviceCode === opt.serviceCode ? '✓ 已選擇' : '選擇此服務'}
                  </button>
                </div>

                {/* Charge breakdown toggle */}
                {opt.chargeBreakdown && (
                  <>
                    <button type="button"
                      onClick={() => setExpandedBreakdown(expandedBreakdown === key ? null : key)}
                      className="text-xs text-gray-400 hover:text-gray-600">
                      {expandedBreakdown === key ? '▲ 收起明細' : '▼ 查看費用明細'}
                    </button>
                    {expandedBreakdown === key && (
                      <div className="text-xs text-gray-600 space-y-1 border-t pt-2">
                        {opt.chargeBreakdown.baseCharge != null && (
                          <div className="flex justify-between">
                            <span>基本運費</span>
                            <span className="font-mono">{opt.chargeBreakdown.currency} {opt.chargeBreakdown.baseCharge.toFixed(2)}</span>
                          </div>
                        )}
                        {opt.chargeBreakdown.surcharges.map(s => (
                          <div key={s.code} className="flex justify-between text-gray-500">
                            <span>{s.label}</span>
                            <span className="font-mono">{opt.chargeBreakdown!.currency} {s.amount.toFixed(2)}</span>
                          </div>
                        ))}
                        {opt.chargeBreakdown.taxAmount != null && (
                          <div className="flex justify-between text-gray-500">
                            <span>稅費</span>
                            <span className="font-mono">{opt.chargeBreakdown.currency} {opt.chargeBreakdown.taxAmount.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── 出貨方式確認（選完服務後出現，建提單前） ── */}
      {selectedOption && !shipmentResult && (
        <div className="bg-white rounded-lg border p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">確認出貨方式</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              已選：{selectedOption.serviceName}
              {selectedOption.contractEstimate != null
                ? ` — ${selectedOption.currency} ${selectedOption.contractEstimate.toLocaleString()}`
                : ` — ${selectedOption.currency} ${selectedOption.amount.toLocaleString()}`}
            </p>
          </div>

          {/* 選擇：預約提貨 or 自送 */}
          <div className="grid grid-cols-2 gap-3">
            <button type="button"
              onClick={() => setDeliveryMethod('pickup')}
              className={`p-3 rounded-lg border-2 text-left transition-colors ${
                deliveryMethod === 'pickup'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
              <p className="text-sm font-medium text-gray-800">🚚 預約 UPS 來取貨</p>
              <p className="text-xs text-gray-500 mt-0.5">指定日期讓 UPS 到府取件</p>
            </button>
            <button type="button"
              onClick={() => setDeliveryMethod('dropoff')}
              className={`p-3 rounded-lg border-2 text-left transition-colors ${
                deliveryMethod === 'dropoff'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
              <p className="text-sm font-medium text-gray-800">📦 自送 UPS 轉運站</p>
              <p className="text-xs text-gray-500 mt-0.5">自行送件至 UPS 門市或轉運站</p>
            </button>
          </div>

          {/* 預約提貨表單（只在選 pickup 時顯示） */}
          {deliveryMethod === 'pickup' && (
            <div className="space-y-3 border-t pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">提貨日期</label>
                  <input type="date"
                    value={pickupDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}
                    onChange={e => setPickupDate(e.target.value.replace(/-/g, ''))}
                    className="mt-1 w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">聯絡電話</label>
                  <input value={pickupPhone} onChange={e => setPickupPhone(e.target.value)}
                    placeholder="02-12345678"
                    className="mt-1 w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">可供提貨（最早）</label>
                  <input value={pickupReady} onChange={e => setPickupReady(e.target.value)}
                    placeholder="1400"
                    maxLength={4}
                    className="mt-1 w-full border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">最晚關門時間</label>
                  <input value={pickupClose} onChange={e => setPickupClose(e.target.value)}
                    placeholder="1800"
                    maxLength={4}
                    className="mt-1 w-full border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
            </div>
          )}

          {deliveryMethod === 'dropoff' && (
            <p className="text-xs text-gray-500 border-t pt-3">
              建立提單後請自行將包裹送至附近的 UPS 門市或授權轉運站。
            </p>
          )}

          {/* 錯誤 */}
          {shipmentError && (
            <p className="text-sm text-red-600 bg-red-50 rounded p-2">❌ {shipmentError}</p>
          )}

          {/* 確認建立按鈕 */}
          <button type="button"
            onClick={handleConfirmShipment}
            disabled={
              !deliveryMethod ||
              creatingShipment ||
              (deliveryMethod === 'pickup' && (!pickupPhone || !pickupDate))
            }
            className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed">
            {creatingShipment
              ? (deliveryMethod === 'pickup' ? '建立提單並預約提貨中...' : '建立提單中...')
              : (deliveryMethod === 'pickup' ? '✓ 確認出貨 — 建立提單並預約提貨' : '✓ 確認出貨 — 建立提單')}
          </button>
        </div>
      )}

      {/* ── 建提單結果 ── */}
      {shipmentResult && (
        <div className="bg-white rounded-lg border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-green-700">✓ 提單已建立</h2>
            <div className="flex gap-2 flex-wrap justify-end">
              {/* 多箱時顯示每箱個別下載；單箱直接下載 */}
              {shipmentResult.allLabels && shipmentResult.allLabels.length > 1
                ? shipmentResult.allLabels.map((lbl, i) => (
                    <button key={lbl.trackingNumber}
                      onClick={() => {
                        const fmt = (shipmentResult.labelFormat ?? 'GIF').toLowerCase()
                        const mime = fmt === 'pdf' ? 'application/pdf' : `image/${fmt}`
                        const url = `data:${mime};base64,${lbl.labelBase64}`
                        const a = document.createElement('a')
                        a.href = url; a.download = `UPS_${lbl.trackingNumber}.${fmt}`; a.click()
                      }}
                      className="text-xs px-2.5 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700">
                      ⬇ 標籤 {i + 1}
                    </button>
                  ))
                : (
                    <button onClick={downloadLabel}
                      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700">
                      ⬇ 下載標籤
                    </button>
                  )
              }
            </div>
          </div>

          <div className="bg-gray-50 rounded p-3 space-y-1 text-sm">
            {shipmentResult.allLabels && shipmentResult.allLabels.length > 1 ? (
              <div>
                <p className="text-gray-500 text-xs mb-1">Tracking Numbers（{shipmentResult.allLabels.length} 箱）</p>
                {shipmentResult.allLabels.map((lbl, i) => (
                  <p key={lbl.trackingNumber} className="font-mono font-bold text-sm">
                    箱{i + 1}：{lbl.trackingNumber}
                  </p>
                ))}
              </div>
            ) : (
              <p><span className="text-gray-500 text-xs">Tracking Number</span><br />
                <span className="font-mono font-bold text-base">{shipmentResult.trackingNumber}</span>
              </p>
            )}
            {shipmentResult.chargedAmount && (
              <p className="text-xs text-gray-500">
                費用：{shipmentResult.chargedCurrency} {shipmentResult.chargedAmount.toFixed(2)}
              </p>
            )}
            {selectedPiId && piList.find(p => p.id === selectedPiId) && (
              <p className="text-xs text-gray-500">
                關聯 PI：{piList.find(p => p.id === selectedPiId)?.piNo}
              </p>
            )}
          </div>

          {/* 提貨預約結果 */}
          {shipmentResult.pickupConfirmation && (
            <div className="bg-green-50 rounded p-3">
              <p className="text-sm font-medium text-green-800">✓ 提貨預約完成</p>
              <p className="text-xs text-green-700 mt-1">
                確認號：<span className="font-mono font-bold">{shipmentResult.pickupConfirmation}</span>
              </p>
              {shipmentResult.pickupDueDate && (
                <p className="text-xs text-green-600">預計提貨：{shipmentResult.pickupDueDate}</p>
              )}
            </div>
          )}
          {deliveryMethod === 'dropoff' && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">
              📦 請自行將包裹送至 UPS 門市或授權轉運站。
            </p>
          )}

          {/* 提單已建但預約失敗的錯誤 */}
          {shipmentError && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded p-2">⚠️ {shipmentError}</p>
          )}
        </div>
      )}

      {/* ── Section F: Save to PAXIS ── */}
      {selectedPiId && !paxisSaved && (
        <div className="bg-white rounded-lg border border-indigo-200 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-indigo-800">記錄出貨到 PAXIS</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              將本次出貨資料（箱數、毛重、材積）儲存為 SLS_Shipment，
              並自動扣減庫存及建立應收帳款。
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500">實際出貨日 *</label>
              <input type="date" value={paxisActualShipDate}
                onChange={e => setPaxisActualShipDate(e.target.value)}
                className="mt-1 w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500">裝箱單號 P/L No.</label>
              <input value={paxisPackingListNo}
                onChange={e => setPaxisPackingListNo(e.target.value)}
                placeholder="選填"
                className="mt-1 w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500">商業發票號 C/I No.</label>
              <input value={paxisCommercialInvNo}
                onChange={e => setPaxisCommercialInvNo(e.target.value)}
                placeholder="選填"
                className="mt-1 w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
          {shipmentResult?.trackingNumber && (
            <p className="text-xs text-green-600 bg-green-50 rounded px-3 py-1.5">
              ✓ UPS Tracking No. <span className="font-mono font-bold">{shipmentResult.trackingNumber}</span> 將一併記錄
            </p>
          )}
          {paxisError && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-2 py-1.5">❌ {paxisError}</p>
          )}
          <button type="button" onClick={handleSaveToPaxis} disabled={paxisSaving}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {paxisSaving ? '儲存中…' : '✓ 確認記錄出貨到 PAXIS'}
          </button>
        </div>
      )}

      {/* PAXIS 儲存成功 */}
      {paxisSaved && (
        <div className="bg-white rounded-lg border border-green-300 p-5">
          <h2 className="text-sm font-semibold text-green-700">✓ 已記錄到 PAXIS</h2>
          <div className="mt-2 space-y-1 text-xs text-gray-600">
            <p>出貨單號：<span className="font-mono font-bold">{paxisSaved.shipmentNo}</span></p>
            <p className="text-gray-400">庫存已扣減，應收帳款已建立</p>
          </div>
          <a href={`/sales`}
            className="mt-3 inline-block text-xs text-indigo-600 hover:underline">
            → 前往客戶訂單查看
          </a>
        </div>
      )}

      {/* Contact picker modal */}
      {picker && (
        <ContactPicker
          type={picker.type}
          onSelect={handlePickContact}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}
