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

type Item = {
  productName: string
  sku: string
  modelNo: string
  specification: string
  unit: string
  quantity: number
  unitPrice: number
  amount: number
  currencyCode: string
}

type POData = {
  po: {
    id: number
    poNo: string
    orderDate: string | null
    expectedDate: string | null
    tradeTerms: string | null
    currencyCode: string
    status: number
    note: string | null
  }
  supplier: {
    id: number
    name: string
    address: string | null
    city: string | null
    countryCode: string | null
    contactPerson: string | null
    email: string | null
    paymentTerms: string | null
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
    logoBase64: string | null
  } | null
  items: Item[]
  totals: { amount: number; currencyCode: string }
}

type FreeFields = {
  remarks: string
  deliveryAddress: string
  specialInstructions: string
}

const EMPTY_FREE: FreeFields = { remarks: '', deliveryAddress: '', specialInstructions: '' }

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

type TemplateOption = { id: number; name: string; isDefault: boolean }

function renderTemplate(html: string, data: POData, freeFields: FreeFields): string {
  const { po, supplier, company, items, totals } = data
  const currency = po.currencyCode

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
    'supplier.name': supplier?.name ?? '',
    'supplier.address': supplier?.address ?? '',
    'supplier.city': supplier?.city ?? '',
    'supplier.countryCode': supplier?.countryCode ?? '',
    'supplier.contactPerson': supplier?.contactPerson ?? '',
    'supplier.email': supplier?.email ?? '',
    'supplier.paymentTerms': supplier?.paymentTerms ?? '',
    'po.poNo': po.poNo,
    'po.orderDate': fmtDate(po.orderDate),
    'po.expectedDate': fmtDate(po.expectedDate),
    'po.tradeTerms': po.tradeTerms ?? '',
    'po.currencyCode': currency,
    'totals.amount': `${currency} ${fmt(totals.amount)}`,
    'totals.currencyCode': currency,
    'free.remarks': freeFields.remarks,
    'free.deliveryAddress': freeFields.deliveryAddress,
    'free.specialInstructions': freeFields.specialInstructions,
  }

  let result = html.replace(/\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/g, (_match, rowTpl: string) => {
    return items.map(item => {
      let row = rowTpl
      const itemVars: Record<string, string> = {
        'item.productName': item.productName,
        'item.sku': item.sku,
        'item.modelNo': item.modelNo,
        'item.specification': item.specification,
        'item.unit': item.unit,
        'item.quantity': item.quantity.toLocaleString(),
        'item.unitPrice': `${currency} ${fmt(item.unitPrice)}`,
        'item.amount': `${currency} ${fmt(item.amount)}`,
        'item.currencyCode': currency,
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

export default function PrintPOPage() {
  const { poId } = useParams<{ poId: string }>()
  const [data, setData] = useState<POData | null>(null)
  const [loading, setLoading] = useState(true)
  const [freeFields, setFreeFields] = useState<FreeFields>(EMPTY_FREE)
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | 'builtin'>('builtin')
  const [customHtml, setCustomHtml] = useState<string | null>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)

  const sealManager = useSealManager()
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/print/po/${poId}`)
      .then(r => r.json())
      .then((d: POData) => { setData(d); if (d.po?.poNo) document.title = d.po.poNo; setLoading(false) })

    fetch('/api/print/templates?docType=PO')
      .then(r => r.json())
      .then((list: TemplateOption[]) => {
        setTemplates(list)
        const def = list.find(t => t.isDefault)
        if (def) setSelectedTemplateId(def.id)
      })
  }, [poId])

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

  const handleClose = useCallback(() => {
    if (window.history.length > 1) window.history.back()
    else window.close()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">載入中...</div>
  if (!data) return <div className="flex items-center justify-center h-screen text-red-500">找不到此 PO</div>

  const { po, company, supplier } = data
  const currency = po.currencyCode

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
        <span className="text-gray-300 font-mono">{po.poNo}</span>
        {supplier && <span className="text-gray-400">— {supplier.name}</span>}
        <div className="ml-auto">
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
            { key: 'deliveryAddress',    label: 'Delivery Address' },
            { key: 'specialInstructions', label: 'Special Instructions' },
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
            <label className="block text-xs text-gray-500 mb-1">Remarks</label>
            <textarea
              value={freeFields.remarks}
              onChange={e => setFreeFields(prev => ({ ...prev, remarks: e.target.value }))}
              rows={4}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
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
              : <PODocument data={data} freeFields={freeFields} currency={currency} company={company} supplier={supplier} />
            }
            <SealOverlayLayer manager={sealManager} containerRef={previewRef} />
            <PageBreakIndicator />
          </div>
        </main>
      </div>

      <div className="print-only" style={{ position: 'relative' }}>
        {customHtml
          ? <div dangerouslySetInnerHTML={{ __html: renderTemplate(customHtml, data, freeFields) }} />
          : <PODocument data={data} freeFields={freeFields} currency={currency} company={company} supplier={supplier} />
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

function PODocument({ data, freeFields, currency, company, supplier }: {
  data: POData
  freeFields: FreeFields
  currency: string
  company: POData['company']
  supplier: POData['supplier']
}) {
  const { po, items, totals } = data

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
              <div style={{ fontSize: '13pt', fontWeight: 'bold', marginBottom: '2mm' }}>
                {company?.nameEn || company?.nameZh || ''}
              </div>
              {company?.nameZh && company?.nameEn && (
                <div style={{ fontSize: '9pt', color: '#555', marginBottom: '1mm' }}>{company.nameZh}</div>
              )}
              <div style={{ fontSize: '8pt', color: '#444', lineHeight: '1.5' }}>
                {company?.addressEn && <div>{company.addressEn}</div>}
                {company?.city && <div>{company.city}{company?.countryCode ? `, ${company.countryCode}` : ''}</div>}
                {company?.phone && <div>Tel: {company.phone}</div>}
                {company?.fax && <div>Fax: {company.fax}</div>}
                {company?.email && <div>Email: {company.email}</div>}
              </div>
            </td>
            <td style={{ width: '40%', verticalAlign: 'top', textAlign: 'right' }}>
              <div style={{ fontSize: '16pt', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '3mm' }}>
                PURCHASE ORDER
              </div>
              <table style={{ marginLeft: 'auto', fontSize: '8.5pt', borderCollapse: 'collapse' }}>
                <tbody>
                  <MetaRow label="PO No." value={po.poNo} />
                  <MetaRow label="Date" value={fmtDate(po.orderDate)} />
                  {po.expectedDate && <MetaRow label="Expected" value={fmtDate(po.expectedDate)} />}
                  {po.tradeTerms && <MetaRow label="Trade Terms" value={po.tradeTerms} />}
                  {supplier?.paymentTerms && <MetaRow label="Payment" value={supplier.paymentTerms} />}
                  <MetaRow label="Currency" value={currency} />
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
              <div style={{ fontWeight: 'bold', marginBottom: '1mm', fontSize: '7.5pt', color: '#666', textTransform: 'uppercase' }}>Buyer</div>
              {company && (
                <>
                  <div style={{ fontWeight: 'bold' }}>{company.nameEn || company.nameZh}</div>
                  {company.addressEn && <div>{company.addressEn}</div>}
                  {company.city && <div>{company.city}{company.countryCode ? `, ${company.countryCode}` : ''}</div>}
                  {company.taxId && <div>Tax ID: {company.taxId}</div>}
                </>
              )}
            </td>
            <td style={{ width: '4%' }} />
            <td style={{ width: '48%', verticalAlign: 'top', border: '1px solid #ccc', padding: '3mm', fontSize: '8.5pt' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '1mm', fontSize: '7.5pt', color: '#666', textTransform: 'uppercase' }}>Seller / Supplier</div>
              {supplier ? (
                <>
                  <div style={{ fontWeight: 'bold' }}>{supplier.name}</div>
                  {supplier.address && <div>{supplier.address}</div>}
                  {supplier.city && <div>{supplier.city}{supplier.countryCode ? `, ${supplier.countryCode}` : ''}</div>}
                  {supplier.contactPerson && <div>Attn: {supplier.contactPerson}</div>}
                  {supplier.email && <div>{supplier.email}</div>}
                </>
              ) : <div style={{ color: '#999' }}>—</div>}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 品項表格 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4mm', fontSize: '8.5pt' }}>
        <thead style={{ display: 'table-header-group' }}>
          <tr style={{ backgroundColor: '#2d5016', color: '#fff' }}>
            <th style={{ padding: '2mm', textAlign: 'left', fontWeight: 'normal' }}>Item / Description</th>
            <th style={{ padding: '2mm', textAlign: 'center', fontWeight: 'normal', whiteSpace: 'nowrap' }}>Model No.</th>
            <th style={{ padding: '2mm', textAlign: 'center', fontWeight: 'normal' }}>Unit</th>
            <th style={{ padding: '2mm', textAlign: 'right', fontWeight: 'normal' }}>Qty</th>
            <th style={{ padding: '2mm', textAlign: 'right', fontWeight: 'normal', whiteSpace: 'nowrap' }}>Unit Price</th>
            <th style={{ padding: '2mm', textAlign: 'right', fontWeight: 'normal' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', pageBreakInside: 'avoid' }}>
              <td style={{ padding: '2mm', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold' }}>{item.productName}</div>
                {item.sku && <div style={{ color: '#666', fontSize: '7.5pt' }}>SKU: {item.sku}</div>}
                {item.specification && <div style={{ color: '#555', fontSize: '7.5pt' }}>{item.specification}</div>}
              </td>
              <td style={{ padding: '2mm', textAlign: 'center', verticalAlign: 'top', color: '#444' }}>{item.modelNo || '—'}</td>
              <td style={{ padding: '2mm', textAlign: 'center', verticalAlign: 'top' }}>{item.unit}</td>
              <td style={{ padding: '2mm', textAlign: 'right', verticalAlign: 'top' }}>{item.quantity.toLocaleString()}</td>
              <td style={{ padding: '2mm', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{currency} {fmt(item.unitPrice)}</td>
              <td style={{ padding: '2mm', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{currency} {fmt(item.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #2d5016', backgroundColor: '#f8f9fa' }}>
            <td colSpan={4} />
            <td style={{ padding: '2mm', textAlign: 'right', fontWeight: 'bold' }}>TOTAL</td>
            <td style={{ padding: '2mm', textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
              {currency} {fmt(totals.amount)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* 備註 */}
      {(freeFields.remarks || freeFields.deliveryAddress || freeFields.specialInstructions || po.note) && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6mm', fontSize: '8.5pt' }}>
          <tbody>
            <tr>
              <td style={{ verticalAlign: 'top' }}>
                {freeFields.deliveryAddress && (
                  <div style={{ border: '1px solid #ccc', padding: '3mm', marginBottom: '2mm' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '1mm', fontSize: '7.5pt', color: '#666', textTransform: 'uppercase' }}>Delivery Address</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{freeFields.deliveryAddress}</div>
                  </div>
                )}
                {(freeFields.remarks || po.note) && (
                  <div style={{ border: '1px solid #ccc', padding: '3mm', marginBottom: '2mm' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '1mm', fontSize: '7.5pt', color: '#666', textTransform: 'uppercase' }}>Remarks</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{freeFields.remarks || po.note}</div>
                  </div>
                )}
                {freeFields.specialInstructions && (
                  <div style={{ border: '1px solid #ccc', padding: '3mm' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '1mm', fontSize: '7.5pt', color: '#666', textTransform: 'uppercase' }}>Special Instructions</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{freeFields.specialInstructions}</div>
                  </div>
                )}
              </td>
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
                <div style={{ color: '#555', fontSize: '7.5pt' }}>Authorized Signature</div>
                <div style={{ height: '12mm' }} />
                <div style={{ fontWeight: 'bold' }}>{company?.nameEn || company?.nameZh || ''}</div>
              </td>
              <td style={{ width: '10%' }} />
              <td style={{ width: '45%', borderTop: '1px solid #000', paddingTop: '1mm', textAlign: 'center' }}>
                <div style={{ color: '#555', fontSize: '7.5pt' }}>Acknowledged by Supplier</div>
                <div style={{ height: '12mm' }} />
                <div style={{ fontWeight: 'bold' }}>{supplier?.name || ''}</div>
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
