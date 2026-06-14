'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  useSealManager,
  SealSidebarSection,
  SealOverlayLayer,
  SealPrintLayer,
  PageBreakIndicator,
  type PlacedSealDef,
} from '@/components/print/SealManager'

type ShipmentItem = {
  productName: string
  sku: string
  modelNo: string
  specification: string
  unit: string
  quantity: number
  cartons: number | null
  cartonNoFrom: string | null
  cartonNoTo: string | null
  grossWeightKg: number | null
  netWeightKg: number | null
  cbm: number | null
  unitPrice: number
  amount: number
  piNo: string | null
}

type ShipmentData = {
  shipment: {
    id: number
    shipmentNo: string
    packingListNo: string | null
    commercialInvNo: string | null
    actualShipDate: string
    shippingMethod: string | null
    portOfLoading: string | null
    portOfDischarge: string | null
    trackingNo: string | null
    currencyCode: string
    piNos: string
  }
  customer: {
    id: number
    name: string
    address: string | null
    city: string | null
    countryCode: string | null
    contactPerson: string | null
    email: string | null
  } | null
  company: {
    nameEn: string
    nameZh: string
    addressEn: string
    city: string
    countryCode: string
    phone: string
    fax: string
    email: string
    taxId: string
    bankName: string
    bankAccount: string
    bankSwift: string
    logoBase64: string | null
  } | null
  items: ShipmentItem[]
  totals: {
    cartons: number | null
    grossWeightKg: number | null
    netWeightKg: number | null
    cbm: number | null
    amount: number
    currencyCode: string
  }
}

type FreeFields = {
  countryOfOrigin: string
  shippingMarks: string
  remarks: string
}

const EMPTY_FREE: FreeFields = { countryOfOrigin: '', shippingMarks: '', remarks: '' }

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

type TemplateOption = { id: number; name: string; isDefault: boolean }

function renderTemplate(html: string, data: ShipmentData, freeFields: FreeFields): string {
  const { shipment, customer, company, items, totals } = data

  const vars: Record<string, string> = {
    'company.logo': company?.logoBase64
      ? `<img src="${company.logoBase64}" style="max-height:60px;max-width:180px;object-fit:contain" alt="logo" />`
      : '',
    'company.nameEn': company?.nameEn ?? '',
    'company.nameZh': company?.nameZh ?? '',
    'company.addressEn': company?.addressEn ?? '',
    'company.city': company?.city ?? '',
    'company.countryCode': company?.countryCode ?? '',
    'company.phone': company?.phone ?? '',
    'company.fax': company?.fax ?? '',
    'company.email': company?.email ?? '',
    'company.taxId': company?.taxId ?? '',
    'customer.name': customer?.name ?? '',
    'customer.address': customer?.address ?? '',
    'customer.city': customer?.city ?? '',
    'customer.countryCode': customer?.countryCode ?? '',
    'customer.contactPerson': customer?.contactPerson ?? '',
    'shipment.shipmentNo': shipment.shipmentNo,
    'shipment.packingListNo': shipment.packingListNo ?? '',
    'shipment.actualShipDate': fmtDate(shipment.actualShipDate),
    'shipment.portOfLoading': shipment.portOfLoading ?? '',
    'shipment.portOfDischarge': shipment.portOfDischarge ?? '',
    'shipment.trackingNo': shipment.trackingNo ?? '',
    'shipment.piNos': shipment.piNos,
    'totals.cartons': totals.cartons ? String(totals.cartons) : '',
    'totals.grossWeightKg': totals.grossWeightKg ? fmt(totals.grossWeightKg, 1) : '',
    'totals.netWeightKg': totals.netWeightKg ? fmt(totals.netWeightKg, 1) : '',
    'totals.cbm': totals.cbm ? fmt(totals.cbm, 3) : '',
    'free.countryOfOrigin': freeFields.countryOfOrigin,
    'free.shippingMarks': freeFields.shippingMarks,
    'free.remarks': freeFields.remarks,
  }

  let result = html.replace(/\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/g, (_match, rowTpl: string) => {
    return items.map(item => {
      let row = rowTpl
      const cartonRange = item.cartonNoFrom
        ? item.cartonNoTo && item.cartonNoTo !== item.cartonNoFrom
          ? `${item.cartonNoFrom}–${item.cartonNoTo}`
          : item.cartonNoFrom
        : ''
      const itemVars: Record<string, string> = {
        'item.productName': item.productName,
        'item.sku': item.sku,
        'item.modelNo': item.modelNo,
        'item.specification': item.specification,
        'item.unit': item.unit,
        'item.quantity': item.quantity.toLocaleString(),
        'item.cartons': item.cartons ? String(item.cartons) : '',
        'item.cartonNoFrom': item.cartonNoFrom ?? '',
        'item.cartonNoTo': item.cartonNoTo ?? '',
        'item.cartonRange': cartonRange,
        'item.grossWeightKg': item.grossWeightKg ? fmt(item.grossWeightKg, 1) : '',
        'item.netWeightKg': item.netWeightKg ? fmt(item.netWeightKg, 1) : '',
        'item.cbm': item.cbm ? fmt(item.cbm, 3) : '',
        'item.piNo': item.piNo ?? '',
      }
      for (const [k, v] of Object.entries(itemVars)) {
        row = row.replaceAll(`{{${k}}}`, v)
      }
      return row
    }).join('')
  })

  for (const [k, v] of Object.entries(vars)) {
    result = result.replaceAll(`{{${k}}}`, v)
  }
  return result
}

export default function PrintPLPage() {
  const { shipmentId } = useParams<{ shipmentId: string }>()
  const [data, setData] = useState<ShipmentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [freeFields, setFreeFields] = useState<FreeFields>(EMPTY_FREE)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | 'builtin'>('builtin')
  const [customHtml, setCustomHtml] = useState<string | null>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)

  const sealManager = useSealManager()
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/print/shipment/${shipmentId}`)
      .then(r => r.json())
      .then(async (d: ShipmentData) => {
        setData(d)
        if (d.shipment?.packingListNo || d.shipment?.shipmentNo)
          document.title = d.shipment.packingListNo || d.shipment.shipmentNo
        if (d.customer?.id) {
          const res = await fetch(`/api/customers/${d.customer.id}/print-defaults?docType=SLS_PL`)
          const json = await res.json() as { freeFields: FreeFields | null }
          if (json.freeFields) setFreeFields({ ...EMPTY_FREE, ...json.freeFields })
        }
        setLoading(false)
      })

    fetch('/api/print/templates?docType=SLS_PL')
      .then(r => r.json())
      .then((list: TemplateOption[]) => {
        setTemplates(list)
        const def = list.find(t => t.isDefault)
        if (def) setSelectedTemplateId(def.id)
      })
  }, [shipmentId])

  useEffect(() => {
    if (selectedTemplateId === 'builtin') { setCustomHtml(null); sealManager.clearSeals(); return }
    setLoadingTemplate(true)
    fetch(`/api/print/templates/${selectedTemplateId}`)
      .then(r => r.json())
      .then((t: { htmlBody: string; sealPlacements?: PlacedSealDef[] }) => {
        setCustomHtml(t.htmlBody)
        if (t.sealPlacements?.length) sealManager.loadFromTemplate(t.sealPlacements, sealManager.savedSeals)
        else sealManager.clearSeals()
        setLoadingTemplate(false)
      })
  }, [selectedTemplateId]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveDefaults = useCallback(async () => {
    if (!data?.customer?.id) return
    setSaving(true)
    await fetch(`/api/customers/${data.customer.id}/print-defaults`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docType: 'SLS_PL', freeFields }),
    })
    setSaving(false)
    setSavedMsg('已儲存')
    setTimeout(() => setSavedMsg(''), 2000)
  }, [data, freeFields])

  const handleClose = useCallback(() => {
    if (window.history.length > 1) window.history.back()
    else window.close()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">載入中...</div>
  if (!data) return <div className="flex items-center justify-center h-screen text-red-500">找不到此出貨記錄</div>

  return (
    <>
      <div className="no-print bg-gray-800 text-white px-5 py-2.5 flex items-center gap-3 text-sm">
        <button onClick={handleClose} className="flex items-center gap-1.5 text-gray-300 hover:text-white transition-colors">
          ← 返回
        </button>
        <span className="text-gray-600">|</span>
        <select
          value={selectedTemplateId}
          onChange={e => setSelectedTemplateId(e.target.value === 'builtin' ? 'builtin' : Number(e.target.value))}
          className="bg-gray-700 text-white text-xs border border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="builtin">📄 內建標準模板</option>
          {templates.map(t => (
            <option key={t.id} value={t.id}>{t.isDefault ? '★ ' : ''}{t.name}</option>
          ))}
        </select>
        {loadingTemplate && <span className="text-gray-400 text-xs">載入中…</span>}
        <span className="text-gray-600">|</span>
        <span className="text-gray-300 font-mono">裝箱單 {data.shipment.packingListNo || data.shipment.shipmentNo}</span>
        {data.customer && <span className="text-gray-400">— {data.customer.name}</span>}
        <div className="ml-auto flex items-center gap-3">
          {data.customer?.id && (
            <>
              {savedMsg && <span className="text-green-400 text-xs">{savedMsg}</span>}
              <button onClick={saveDefaults} disabled={saving}
                className="text-xs border border-gray-500 text-gray-300 px-3 py-1 rounded hover:bg-gray-700 disabled:opacity-50">
                {saving ? '儲存中…' : '💾 儲存為此客戶預設值'}
              </button>
            </>
          )}
          <button onClick={() => window.print()} className="border border-gray-400 text-gray-200 px-4 py-1.5 rounded hover:bg-gray-700">
            確認分頁
          </button>
          <button onClick={() => window.print()} className="bg-blue-500 text-white px-4 py-1.5 rounded hover:bg-blue-600">
            🖨 列印 / 儲存 PDF
          </button>
        </div>
      </div>

      <div className="no-print flex" style={{ minHeight: 'calc(100vh - 44px)' }}>
        <aside className="w-60 bg-white border-r border-gray-200 p-4 flex-shrink-0 overflow-y-auto">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">補充資訊</h2>
          {([
            { key: 'countryOfOrigin', label: 'Country of Origin' },
          ] as { key: keyof FreeFields; label: string }[]).map(f => (
            <div key={f.key} className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
              <input
                value={freeFields[f.key]}
                onChange={e => setFreeFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          ))}
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">Shipping Marks</label>
            <textarea value={freeFields.shippingMarks}
              onChange={e => setFreeFields(prev => ({ ...prev, shippingMarks: e.target.value }))}
              rows={4}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono text-xs"
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">Remarks</label>
            <textarea value={freeFields.remarks}
              onChange={e => setFreeFields(prev => ({ ...prev, remarks: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          {data.customer?.id && (
            <button onClick={saveDefaults} disabled={saving}
              className="w-full mt-2 bg-blue-600 text-white py-1.5 rounded text-xs hover:bg-blue-700 disabled:opacity-50">
              {saving ? '儲存中…' : '💾 儲存為預設值'}
            </button>
          )}
          <SealSidebarSection manager={sealManager} selectedTemplateId={selectedTemplateId} />
        </aside>

        <main className="flex-1 bg-gray-200 py-8 px-6 overflow-auto">
          <div
            ref={previewRef}
            className="print-page bg-white mx-auto shadow-lg"
            style={{ position: 'relative', cursor: sealManager.armedSeal ? 'crosshair' : undefined }}
            onClick={e => {
              if (!sealManager.armedSeal || !previewRef.current) return
              const rect = previewRef.current.getBoundingClientRect()
              sealManager.placeSeal(
                (e.clientX - rect.left) / rect.width * 100,
                (e.clientY - rect.top) / rect.height * 100,
              )
            }}
          >
            {customHtml
              ? <div dangerouslySetInnerHTML={{ __html: renderTemplate(customHtml, data, freeFields) }} />
              : <PLDocument data={data} freeFields={freeFields} />
            }
            <SealOverlayLayer manager={sealManager} containerRef={previewRef} />
            <PageBreakIndicator />
          </div>
        </main>
      </div>

      <div className="print-only" style={{ position: 'relative' }}>
        {customHtml
          ? <div dangerouslySetInnerHTML={{ __html: renderTemplate(customHtml, data, freeFields) }} />
          : <PLDocument data={data} freeFields={freeFields} />
        }
        <SealPrintLayer manager={sealManager} />
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; min-height: calc(297mm - 24mm); position: relative; }
          .print-page { display: none !important; }
          @page { size: A4; margin: 12mm 15mm; }
          body { font-size: 9pt; }
        }
        @media screen {
          .print-only { display: none !important; }
          .print-page { width: 210mm; min-height: 297mm; padding: 12mm 15mm; font-size: 9pt; }
        }
      `}</style>
    </>
  )
}

function PLDocument({ data, freeFields }: { data: ShipmentData; freeFields: FreeFields }) {
  const { shipment, customer, company, items, totals } = data

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt', color: '#000' }}>

      {/* 頁首 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6mm' }}>
        <tbody>
          <tr>
            <td style={{ width: '60%', verticalAlign: 'top' }}>
              {company?.logoBase64 && (
                <div style={{ marginBottom: '3mm' }}>
                  <img src={company.logoBase64} alt="logo" style={{ maxHeight: '60px', maxWidth: '180px', objectFit: 'contain' }} />
                </div>
              )}
              <div style={{ fontSize: '13pt', fontWeight: 'bold', marginBottom: '2mm' }}>{company?.nameEn || company?.nameZh || ''}</div>
              {company?.nameZh && company?.nameEn && <div style={{ fontSize: '9pt', color: '#555', marginBottom: '1mm' }}>{company.nameZh}</div>}
              <div style={{ fontSize: '8pt', color: '#444', lineHeight: '1.5' }}>
                {company?.addressEn && <div>{company.addressEn}</div>}
                {company?.city && <div>{company.city}{company?.countryCode ? `, ${company.countryCode}` : ''}</div>}
                {company?.phone && <div>Tel: {company.phone}</div>}
                {company?.fax && <div>Fax: {company.fax}</div>}
              </div>
            </td>
            <td style={{ width: '40%', verticalAlign: 'top', textAlign: 'right' }}>
              <div style={{ fontSize: '16pt', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '3mm' }}>PACKING LIST</div>
              <table style={{ marginLeft: 'auto', fontSize: '8.5pt', borderCollapse: 'collapse' }}>
                <tbody>
                  {shipment.packingListNo && <MetaRow label="P/L No." value={shipment.packingListNo} />}
                  <MetaRow label="Date" value={fmtDate(shipment.actualShipDate)} />
                  {shipment.piNos && <MetaRow label="PI Ref." value={shipment.piNos} />}
                  {shipment.portOfLoading && <MetaRow label="Port of Loading" value={shipment.portOfLoading} />}
                  {shipment.portOfDischarge && <MetaRow label="Port of Discharge" value={shipment.portOfDischarge} />}
                  {shipment.trackingNo && <MetaRow label="B/L No." value={shipment.trackingNo} />}
                  {freeFields.countryOfOrigin && <MetaRow label="Country of Origin" value={freeFields.countryOfOrigin} />}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 買賣雙方 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4mm' }}>
        <tbody>
          <tr>
            <td style={{ width: '48%', verticalAlign: 'top', border: '1px solid #ccc', padding: '3mm', fontSize: '8.5pt' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '1mm', fontSize: '7.5pt', color: '#666', textTransform: 'uppercase' }}>Shipper / Exporter</div>
              {company && (
                <>
                  <div style={{ fontWeight: 'bold' }}>{company.nameEn || company.nameZh}</div>
                  {company.addressEn && <div>{company.addressEn}</div>}
                  {company.city && <div>{company.city}{company.countryCode ? `, ${company.countryCode}` : ''}</div>}
                </>
              )}
            </td>
            <td style={{ width: '4%' }} />
            <td style={{ width: '48%', verticalAlign: 'top', border: '1px solid #ccc', padding: '3mm', fontSize: '8.5pt' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '1mm', fontSize: '7.5pt', color: '#666', textTransform: 'uppercase' }}>Consignee</div>
              {customer ? (
                <>
                  <div style={{ fontWeight: 'bold' }}>{customer.name}</div>
                  {customer.address && <div>{customer.address}</div>}
                  {customer.city && <div>{customer.city}{customer.countryCode ? `, ${customer.countryCode}` : ''}</div>}
                  {customer.contactPerson && <div>Attn: {customer.contactPerson}</div>}
                </>
              ) : <div style={{ color: '#999' }}>—</div>}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 品項表格 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4mm', fontSize: '8.5pt' }}>
        <thead style={{ display: 'table-header-group' }}>
          <tr style={{ backgroundColor: '#4a1a6b', color: '#fff' }}>
            <th style={{ padding: '2mm', textAlign: 'left', fontWeight: 'normal' }}>Description</th>
            <th style={{ padding: '2mm', textAlign: 'center', fontWeight: 'normal' }}>Unit</th>
            <th style={{ padding: '2mm', textAlign: 'right', fontWeight: 'normal' }}>Qty</th>
            <th style={{ padding: '2mm', textAlign: 'center', fontWeight: 'normal', whiteSpace: 'nowrap' }}>C/No.</th>
            <th style={{ padding: '2mm', textAlign: 'right', fontWeight: 'normal', whiteSpace: 'nowrap' }}>Ctns</th>
            <th style={{ padding: '2mm', textAlign: 'right', fontWeight: 'normal', whiteSpace: 'nowrap' }}>G.W. (kg)</th>
            <th style={{ padding: '2mm', textAlign: 'right', fontWeight: 'normal', whiteSpace: 'nowrap' }}>N.W. (kg)</th>
            <th style={{ padding: '2mm', textAlign: 'right', fontWeight: 'normal' }}>CBM</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const cartonRange = item.cartonNoFrom
              ? item.cartonNoTo && item.cartonNoTo !== item.cartonNoFrom
                ? `${item.cartonNoFrom}–${item.cartonNoTo}`
                : item.cartonNoFrom
              : ''
            return (
              <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', pageBreakInside: 'avoid' }}>
                <td style={{ padding: '2mm', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 'bold' }}>{item.productName}</div>
                  {item.sku && <div style={{ color: '#666', fontSize: '7.5pt' }}>SKU: {item.sku}</div>}
                  {item.piNo && <div style={{ color: '#888', fontSize: '7.5pt' }}>PI: {item.piNo}</div>}
                </td>
                <td style={{ padding: '2mm', textAlign: 'center', verticalAlign: 'top' }}>{item.unit}</td>
                <td style={{ padding: '2mm', textAlign: 'right', verticalAlign: 'top' }}>{item.quantity.toLocaleString()}</td>
                <td style={{ padding: '2mm', textAlign: 'center', verticalAlign: 'top', fontFamily: 'monospace', fontSize: '8pt' }}>{cartonRange}</td>
                <td style={{ padding: '2mm', textAlign: 'right', verticalAlign: 'top' }}>{item.cartons ?? ''}</td>
                <td style={{ padding: '2mm', textAlign: 'right', verticalAlign: 'top' }}>{item.grossWeightKg ? fmt(item.grossWeightKg, 1) : ''}</td>
                <td style={{ padding: '2mm', textAlign: 'right', verticalAlign: 'top' }}>{item.netWeightKg ? fmt(item.netWeightKg, 1) : ''}</td>
                <td style={{ padding: '2mm', textAlign: 'right', verticalAlign: 'top' }}>{item.cbm ? fmt(item.cbm, 3) : ''}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #4a1a6b', backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>
            <td colSpan={2} style={{ padding: '2mm' }}>TOTAL</td>
            <td style={{ padding: '2mm', textAlign: 'right' }}>{items.reduce((s, i) => s + i.quantity, 0).toLocaleString()}</td>
            <td />
            <td style={{ padding: '2mm', textAlign: 'right' }}>{totals.cartons ?? ''}</td>
            <td style={{ padding: '2mm', textAlign: 'right' }}>{totals.grossWeightKg ? fmt(totals.grossWeightKg, 1) : ''}</td>
            <td style={{ padding: '2mm', textAlign: 'right' }}>{totals.netWeightKg ? fmt(totals.netWeightKg, 1) : ''}</td>
            <td style={{ padding: '2mm', textAlign: 'right' }}>{totals.cbm ? fmt(totals.cbm, 3) : ''}</td>
          </tr>
        </tfoot>
      </table>

      {/* 麥頭 & 備註 */}
      {(freeFields.shippingMarks || freeFields.remarks) && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4mm', fontSize: '8.5pt' }}>
          <tbody>
            <tr>
              {freeFields.shippingMarks && (
                <td style={{ width: '48%', verticalAlign: 'top', border: '1px solid #ccc', padding: '3mm' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '1mm', fontSize: '7.5pt', color: '#666', textTransform: 'uppercase' }}>Shipping Marks</div>
                  <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: '8.5pt' }}>{freeFields.shippingMarks}</div>
                </td>
              )}
              {freeFields.shippingMarks && freeFields.remarks && <td style={{ width: '4%' }} />}
              {freeFields.remarks && (
                <td style={{ verticalAlign: 'top', border: '1px solid #ccc', padding: '3mm' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '1mm', fontSize: '7.5pt', color: '#666', textTransform: 'uppercase' }}>Remarks</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{freeFields.remarks}</div>
                </td>
              )}
            </tr>
          </tbody>
        </table>
      )}

      {/* 簽名欄 */}
      <div style={{ pageBreakInside: 'avoid', marginTop: '8mm' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt' }}>
          <tbody>
            <tr>
              <td style={{ width: '45%', borderTop: '1px solid #000', paddingTop: '1mm', textAlign: 'center' }}>
                <div style={{ color: '#555', fontSize: '7.5pt' }}>Authorized Signature &amp; Company Chop</div>
                <div style={{ height: '12mm' }} />
                <div style={{ fontWeight: 'bold' }}>{company?.nameEn || company?.nameZh || ''}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <tr>
      <td style={{ color: '#666', paddingRight: '3mm', paddingBottom: '0.5mm', whiteSpace: 'nowrap' }}>{label}:</td>
      <td style={{ fontWeight: 'bold', paddingBottom: '0.5mm' }}>{value}</td>
    </tr>
  )
}
