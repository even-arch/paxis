'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type NoticeItem = {
  poNo: string
  sku: string | null
  name: string
  poQuantity: number
  notifiedQuantity: number
  unit: string
}

type PackingRow = {
  piNo: string | null
  poNo: string | null
  sku: string | null
  productName: string | null
  quantity: number
  unit: string | null
  cartons: number | null
  cartonNoFrom: string | null
  cartonNoTo: string | null
  cubicFt: string | null
  cbm: string | null
  netWeightKg: string | null
  grossWeightKg: string | null
}

type SNData = {
  notice: {
    id: number
    noticeNo: string
    issueDate: string
    status: string
    note: string | null
    deliverToName: string | null
    deliverToAddress: string | null
    deliverToContact: string | null
    expectedDeliveryDate: string | null
    inCharge: string | null
    items: NoticeItem[]
  }
  supplier: {
    name: string
    shortName: string | null
    address: string | null
    city: string | null
    countryCode: string | null
    phoneNo: string | null
    fax: string | null
    email: string | null
    contactPerson: string | null
  }
  company: {
    nameZh: string
    nameEn: string
    addressZh: string
    addressEn: string
    phone: string
    fax: string
    email: string
    logoBase64: string | null
  } | null
  shipment: {
    shipmentNo: string
    soNo: string | null
    vesselVoyage: string | null
    shippingLine: string | null
    customsClosingDate: string | null
    soEtd: string | null
    soEta: string | null
    containerYard: string | null
    placeOfReceipt: string | null
    portOfLoading: string | null
    portOfDischarge: string | null
    warehouseInFrom: string | null
    warehouseInUntil: string | null
    forwarderName: string | null
    forwarderContact: string | null
    shippingMarks: string | null
  } | null
  packingRows: PackingRow[]
}

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) : null

const fmtNum = (s: string | null, dec = 2) => {
  if (!s) return '—'
  const n = parseFloat(s)
  return isNaN(n) ? '—' : n.toFixed(dec).replace(/\.?0+$/, '')
}

function cartonLabel(r: PackingRow) {
  if (!r.cartonNoFrom) return '—'
  if (r.cartonNoTo && r.cartonNoTo !== r.cartonNoFrom) return `${r.cartonNoFrom}–${r.cartonNoTo}`
  return r.cartonNoFrom
}

// GW/NW/材積是「每箱」值：總計需依箱號範圍去重後乘箱數（與出貨單 PL 頁一致）
function boxCount(r: PackingRow) {
  const from = parseInt(r.cartonNoFrom ?? '0') || 0
  const to = parseInt(r.cartonNoTo ?? r.cartonNoFrom ?? '0') || from
  return from > 0 ? Math.max(1, to - from + 1) : (r.cartons ?? 1)
}

export default function ShippingNoticePrintPage() {
  const params = useParams<{ noticeId: string }>()
  const [data, setData] = useState<SNData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/print/shipping-notice/${params.noticeId}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? '載入失敗')
        return r.json()
      })
      .then(setData)
      .catch(e => setError(e.message))
  }, [params.noticeId])

  // 列印/存 PDF 的預設檔名 = 供應商名稱 + 單號（瀏覽器以頁面標題當檔名）
  useEffect(() => {
    if (data) {
      const supplierLabel = data.supplier.shortName ?? data.supplier.name
      document.title = `${supplierLabel} ${data.notice.noticeNo}`
    }
  }, [data])

  if (error) return <div className="p-8 text-red-600">{error}</div>
  if (!data) return <div className="p-8 text-gray-400">載入中...</div>

  return (
    <>
      <div className="no-print sticky top-0 z-10 bg-gray-800 text-white text-sm px-4 py-2 flex items-center gap-3">
        <button onClick={() => history.back()} className="text-gray-300 hover:text-white">← 返回</button>
        <span className="text-gray-600">|</span>
        <span className="text-gray-300 font-mono">{data.notice.noticeNo}</span>
        <span className="text-gray-400">— {data.supplier.name}</span>
        <div className="ml-auto">
          <button onClick={() => window.print()} className="bg-blue-500 text-white px-4 py-1.5 rounded hover:bg-blue-600">
            🖨 列印 / 儲存 PDF
          </button>
        </div>
      </div>

      <div className="no-print bg-gray-200 py-8 px-6 min-h-screen">
        <div className="print-page bg-white mx-auto shadow-lg">
          <SNDocument data={data} />
        </div>
      </div>

      <div className="print-only">
        <SNDocument data={data} />
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
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

const cell: React.CSSProperties = { border: '1px solid #000', padding: '3pt 4pt', verticalAlign: 'top' }
const th: React.CSSProperties = { ...cell, fontWeight: 700, textAlign: 'center', background: '#f2f2f2' }

function SNDocument({ data }: { data: SNData }) {
  const { notice, supplier, company, shipment, packingRows } = data

  // 依 PI 分組（箱號以 PI 為單位由 1 起編）
  const groups = new Map<string, PackingRow[]>()
  for (const r of packingRows) {
    const key = r.piNo ?? '—'
    const arr = groups.get(key) ?? []
    arr.push(r)
    groups.set(key, arr)
  }
  const hasPacking = packingRows.length > 0

  // 總計（每箱值 × 箱數，依箱號去重）
  let totalQty = 0, totalCartons = 0, totalCube = 0, totalNW = 0, totalGW = 0
  {
    const seen = new Set<string>()
    for (const r of packingRows) {
      totalQty += r.quantity
      const key = `${r.piNo}:${r.cartonNoFrom ?? Math.random()}`
      if (seen.has(key)) continue
      seen.add(key)
      const boxes = boxCount(r)
      totalCartons += boxes
      totalCube += parseFloat(r.cubicFt ?? '0') * boxes
      totalNW += parseFloat(r.netWeightKg ?? '0') * boxes
      totalGW += parseFloat(r.grossWeightKg ?? '0') * boxes
    }
  }

  const supplierAddr = [supplier.address, supplier.city, supplier.countryCode].filter(Boolean).join(', ')

  return (
    <div style={{ fontFamily: 'Arial, "Microsoft JhengHei", sans-serif', fontSize: '9pt', color: '#000' }}>
      {/* 公司抬頭 */}
      <div style={{ textAlign: 'right' }}>
        {company?.logoBase64
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={company.logoBase64} alt="logo" style={{ height: '32pt', display: 'inline-block' }} />
          : <span style={{ fontSize: '14pt', fontWeight: 700 }}>{company?.nameEn || company?.nameZh}</span>}
      </div>
      <div style={{ borderTop: '2px solid #000', borderBottom: '1px solid #000', padding: '2pt 0', fontSize: '7.5pt', textAlign: 'center', margin: '4pt 0 12pt' }}>
        {[company?.nameEn, company?.addressEn || company?.addressZh,
          company?.phone && `phone: ${company.phone}`,
          company?.fax && `fax: ${company.fax}`,
          company?.email && `email: ${company.email}`].filter(Boolean).join('　')}
      </div>

      <h1 style={{ textAlign: 'center', fontSize: '13pt', fontWeight: 700, textDecoration: 'underline', margin: '0 0 10pt' }}>
        出貨通知單 Shipment Notice
      </h1>

      {/* To 區塊 */}
      <table style={{ width: '100%', fontSize: '9pt', marginBottom: '8pt' }}>
        <tbody>
          <tr>
            <td style={{ width: '60%', verticalAlign: 'top' }}>
              <table style={{ fontSize: '9pt' }}>
                <tbody>
                  <tr><td style={{ fontWeight: 700, paddingRight: '8pt', verticalAlign: 'top' }}>To:</td>
                    <td><div style={{ fontWeight: 700 }}>{supplier.name}</div>{supplierAddr && <div>{supplierAddr}</div>}</td></tr>
                  {supplier.phoneNo && <tr><td style={{ fontWeight: 700 }}>Phone:</td><td>{supplier.phoneNo}</td></tr>}
                  {supplier.fax && <tr><td style={{ fontWeight: 700 }}>Fax:</td><td>{supplier.fax}</td></tr>}
                  {supplier.email && <tr><td style={{ fontWeight: 700 }}>E-Mail:</td><td>{supplier.email}</td></tr>}
                  {supplier.contactPerson && <tr><td style={{ fontWeight: 700 }}>Attention:</td><td>{supplier.contactPerson}</td></tr>}
                </tbody>
              </table>
            </td>
            <td style={{ verticalAlign: 'top', fontSize: '9pt' }}>
              <div>No. <span style={{ fontFamily: 'monospace' }}>{notice.noticeNo}</span></div>
              <div>{fmtDate(notice.issueDate)}</div>
              {shipment?.soNo && <div>S/O No.: {shipment.soNo}</div>}
              {shipment?.shipmentNo && <div>Ref: {shipment.shipmentNo}</div>}
              {notice.inCharge && <div>In Charge: {notice.inCharge}</div>}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 品項表：優先用出貨單裝箱明細（原封不動），無則用通知品項 */}
      {hasPacking ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt', marginBottom: '10pt' }}>
          <thead>
            <tr>
              <th style={th}>Item No.</th>
              <th style={th}>Description</th>
              <th style={th}>Quantity</th>
              <th style={th}>Package<br />(箱數)</th>
              <th style={th}>Carton Nos.<br />Cube (ft³)</th>
              <th style={th}>N.W.<br />G.W.</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(groups.entries()).map(([piNo, rows]) => (
              <>
                {groups.size > 1 && (
                  <tr key={`g-${piNo}`}>
                    <td colSpan={6} style={{ ...cell, background: '#fafafa', fontWeight: 700 }}>
                      PI / Marks: {piNo}
                    </td>
                  </tr>
                )}
                {rows.map((r, i) => (
                  <tr key={`${piNo}-${i}`}>
                    <td style={{ ...cell, fontFamily: 'monospace' }}>{r.sku ?? '—'}</td>
                    <td style={cell}>
                      {r.productName ?? '—'}
                      {r.poNo && <div style={{ fontSize: '7.5pt', color: '#444' }}>(P/O No. {r.poNo})</div>}
                    </td>
                    <td style={{ ...cell, textAlign: 'right' }}>{r.quantity.toLocaleString()} {r.unit ?? 'pc'}</td>
                    <td style={{ ...cell, textAlign: 'center' }}>{boxCount(r)}</td>
                    <td style={{ ...cell, textAlign: 'center' }}>
                      {cartonLabel(r)}
                      {r.cubicFt && <div>{fmtNum(r.cubicFt)} cu.ft.</div>}
                    </td>
                    <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {fmtNum(r.netWeightKg, 3)} kg<br />{fmtNum(r.grossWeightKg, 3)} kg
                    </td>
                  </tr>
                ))}
              </>
            ))}
            <tr>
              <td style={{ ...cell, fontWeight: 700 }}>Total:</td>
              <td style={cell}></td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totalQty.toLocaleString()}</td>
              <td style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{totalCartons}</td>
              <td style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{totalCube > 0 ? `${totalCube.toFixed(2)} cu.ft.` : '—'}</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {totalNW > 0 ? `${totalNW.toFixed(3)} kg` : '—'}<br />
                {totalGW > 0 ? `${totalGW.toFixed(3)} kg` : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt', marginBottom: '10pt' }}>
          <thead>
            <tr>
              <th style={th}>P/O No.</th>
              <th style={th}>Item No.</th>
              <th style={th}>Description</th>
              <th style={th}>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {notice.items.map((it, i) => (
              <tr key={i}>
                <td style={{ ...cell, fontFamily: 'monospace' }}>{it.poNo}</td>
                <td style={{ ...cell, fontFamily: 'monospace' }}>{it.sku ?? '—'}</td>
                <td style={cell}>{it.name}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{it.notifiedQuantity.toLocaleString()} {it.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 交貨與船務資訊 */}
      <table style={{ width: '100%', fontSize: '9pt', lineHeight: 1.5 }}>
        <tbody>
          <tr>
            <td style={{ width: '55%', verticalAlign: 'top' }}>
              {shipment?.warehouseInUntil && (
                <div><b>Delivery Date（最晚進倉）:</b> {fmtDate(shipment.warehouseInUntil)}
                  {shipment.warehouseInFrom && <span>（最早 {fmtDate(shipment.warehouseInFrom)}）</span>}
                </div>
              )}
              <div><b>Delivery Place:</b> {notice.deliverToName ?? shipment?.containerYard ?? '＿＿＿＿＿＿'}</div>
              {notice.deliverToAddress && <div style={{ paddingLeft: '12pt' }}>{notice.deliverToAddress}</div>}
              {notice.deliverToContact && <div style={{ paddingLeft: '12pt' }}>聯絡：{notice.deliverToContact}</div>}
              {notice.expectedDeliveryDate && (
                <div><b>Delivery By（期望到貨日）:</b> {notice.expectedDeliveryDate.slice(0, 10)}（請務必於此日期前送達）</div>
              )}
              {shipment?.vesselVoyage && <div><b>Vessel:</b> {shipment.vesselVoyage}{shipment.shippingLine ? `（${shipment.shippingLine}）` : ''}</div>}
              {shipment?.placeOfReceipt && <div><b>Place of Receipt:</b> {shipment.placeOfReceipt}</div>}
              {shipment?.portOfLoading && <div><b>Port of Loading:</b> {shipment.portOfLoading}</div>}
              {shipment?.forwarderName && <div><b>Forwarder:</b> {shipment.forwarderName}{shipment.forwarderContact ? ` — ${shipment.forwarderContact}` : ''}</div>}
            </td>
            <td style={{ verticalAlign: 'top' }}>
              {shipment?.customsClosingDate && <div><b>Customs Closing Date:</b> {fmtDate(shipment.customsClosingDate)}</div>}
              {shipment?.soNo && <div><b>S/O No.:</b> {shipment.soNo}</div>}
              {shipment?.soEtd && <div><b>ETD:</b> {fmtDate(shipment.soEtd)}{shipment.soEta ? `　ETA: ${fmtDate(shipment.soEta)}` : ''}</div>}
              {shipment?.portOfDischarge && <div><b>Destination:</b> {shipment.portOfDischarge}</div>}
            </td>
          </tr>
        </tbody>
      </table>

      {notice.note && (
        <div style={{ marginTop: '8pt', fontSize: '9pt' }}>
          <b>Remarks:</b>
          <div style={{ whiteSpace: 'pre-wrap' }}>{notice.note}</div>
        </div>
      )}

      {/* 麥頭：Patisco DO 其它資訊原文，供供應商出貨前核對 */}
      {shipment?.shippingMarks && (
        <div style={{ marginTop: '10pt', fontSize: '9pt' }}>
          <b>Shipping Marks（嘜頭 — 請於出貨前核對）:</b>
          <div style={{
            whiteSpace: 'pre-wrap',
            border: '1px solid #000',
            padding: '6pt 8pt',
            marginTop: '3pt',
            fontFamily: '"Courier New", monospace',
            fontSize: '8.5pt',
            columnCount: 2,
            columnGap: '16pt',
          }}>{shipment.shippingMarks}</div>
        </div>
      )}
    </div>
  )
}
