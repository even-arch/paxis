'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  useSealManager,
  SealSidebarSection,
  SealOverlayLayer,
  SealPrintLayer,
} from '@/components/print/SealManager'

// ─── Types ────────────────────────────────────────────────────────────────────

type PVItem = {
  id: number
  payableId: number
  poNo: string | null
  tradeTerms: string | null
  amountTWD: number
  fobCostDeductionTWD: number
}

type Adjustment = {
  id: number
  name: string
  amountTWD: number
  category: string
  note: string | null
}

type PVData = {
  voucher: {
    id: number
    voucherNo: string
    status: string
    vatPct: number
    note: string | null
    supplierInvoiceNo: string | null
    sentAt: string | null
    confirmedAt: string | null
    paidAt: string | null
    createdAt: string
  }
  supplier: {
    id: number
    name: string
    shortName: string | null
    taxId: string | null
    address: string | null
    city: string | null
    countryCode: string | null
    contactPerson: string | null
    email: string | null
  }
  company: {
    nameZh: string
    nameEn: string
    addressZh: string
    phone: string
    fax: string
    email: string
    taxId: string
    bankName: string
    bankAccount: string
    logoBase64: string | null
  } | null
  items: PVItem[]
  adjustments: Adjustment[]
  totals: {
    subtotalTWD: number
    adjustmentTWD: number
    afterAdjustmentTWD: number
    vatPct: number
    vatTWD: number
    totalTWD: number
    fobDeductionTWD: number
    commissionDeductionTWD: number
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTWD(n: number) {
  return `NT$ ${Math.round(n).toLocaleString()}`
}

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
}

const STATUS_ZH: Record<string, string> = {
  DRAFT: '草稿',
  SENT: '已寄出',
  CONFIRMED: '供應商已確認',
  PAID: '已付款',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrintPVPage() {
  const { voucherId } = useParams<{ voucherId: string }>()
  const [data, setData] = useState<PVData | null>(null)
  const [loading, setLoading] = useState(true)
  // supplierInvoiceNo can be edited inline before printing
  const [invoiceNo, setInvoiceNo] = useState('')

  const sealManager = useSealManager()
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/print/pv/${voucherId}`)
      .then(r => r.json())
      .then((d: PVData) => {
        setData(d)
        setInvoiceNo(d.voucher.supplierInvoiceNo ?? '')
        document.title = `付款通知單 ${d.voucher.voucherNo}`
        setLoading(false)
      })
  }, [voucherId])

  const handleClose = useCallback(() => {
    if (window.history.length > 1) window.history.back()
    else window.close()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">載入中...</div>
  if (!data) return <div className="flex items-center justify-center h-screen text-red-500">找不到此付款通知單</div>

  const { voucher, supplier, company, items, adjustments, totals } = data
  const hasFobDeduction = totals.fobDeductionTWD !== 0
  const hasCommission = totals.commissionDeductionTWD !== 0
  const isCreditNote = hasFobDeduction || hasCommission

  return (
    <>
      {/* ── 工具列（不列印）── */}
      <div className="no-print bg-gray-800 text-white px-5 py-2.5 flex items-center gap-3 text-sm">
        <button onClick={handleClose} className="flex items-center gap-1.5 text-gray-300 hover:text-white transition-colors">
          ← 返回
        </button>
        <span className="text-gray-600">|</span>
        <span className="text-gray-300 font-mono">{voucher.voucherNo}</span>
        <span className="text-gray-400">{STATUS_ZH[voucher.status] ?? voucher.status}</span>
        {isCreditNote && (
          <span className="text-xs bg-orange-700 text-white px-2 py-0.5 rounded">含折讓</span>
        )}
        <div className="flex items-center gap-2 ml-4">
          <label className="text-xs text-gray-400">供應商發票號碼：</label>
          <input
            value={invoiceNo}
            onChange={e => setInvoiceNo(e.target.value)}
            placeholder="（列印前填入）"
            className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 w-40"
          />
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => window.print()} className="bg-blue-500 text-white px-4 py-1.5 rounded hover:bg-blue-600">
            🖨 列印 / 儲存 PDF
          </button>
        </div>
      </div>

      {/* ── 側邊欄（公司章）── */}
      <div className="no-print flex" style={{ minHeight: 'calc(100vh - 44px)' }}>
        <aside className="w-56 bg-white border-r border-gray-200 p-4 flex-shrink-0 overflow-y-auto">
          <SealSidebarSection manager={sealManager} selectedTemplateId="builtin" />
        </aside>

        {/* ── 預覽區 ── */}
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
            <PVDocument data={data} invoiceNo={invoiceNo} />
            <SealOverlayLayer manager={sealManager} containerRef={previewRef} />
          </div>
        </main>
      </div>

      {/* ── 列印層 ── */}
      <div className="print-only" style={{ position: 'relative' }}>
        <PVDocument data={data} invoiceNo={invoiceNo} />
        <SealPrintLayer manager={sealManager} />
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; position: relative; }
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

// ─── Document ─────────────────────────────────────────────────────────────────

function PVDocument({ data, invoiceNo }: { data: PVData; invoiceNo: string }) {
  const { voucher, supplier, company, items, adjustments, totals } = data
  const isCreditNote = totals.fobDeductionTWD !== 0 || totals.commissionDeductionTWD !== 0

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '9pt',
  }
  const thStyle: React.CSSProperties = {
    backgroundColor: '#1a4a2e',
    color: '#fff',
    padding: '2mm 3mm',
    textAlign: 'left',
    fontWeight: 'normal',
  }
  const tdStyle: React.CSSProperties = {
    padding: '1.5mm 3mm',
    borderBottom: '1px solid #e5e7eb',
    verticalAlign: 'top',
  }

  return (
    <div style={{ fontFamily: 'Arial, "Noto Sans TC", sans-serif', fontSize: '9pt', color: '#000' }}>

      {/* 頁首 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '5mm' }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'top', width: '55%' }}>
              {company?.logoBase64 && (
                <img src={company.logoBase64} alt="logo" style={{ maxHeight: '55px', maxWidth: '160px', objectFit: 'contain', marginBottom: '2mm' }} />
              )}
              <div style={{ fontWeight: 'bold', fontSize: '12pt' }}>{company?.nameZh || company?.nameEn || ''}</div>
              {company?.nameEn && company?.nameZh && (
                <div style={{ color: '#555', fontSize: '8pt', marginBottom: '1mm' }}>{company.nameEn}</div>
              )}
              <div style={{ fontSize: '8pt', color: '#444', lineHeight: '1.6' }}>
                {company?.addressZh && <div>{company.addressZh}</div>}
                {company?.phone && <div>Tel: {company.phone}</div>}
                {company?.fax && <div>Fax: {company.fax}</div>}
                {company?.taxId && <div>統編：{company.taxId}</div>}
              </div>
            </td>
            <td style={{ verticalAlign: 'top', textAlign: 'right', width: '45%' }}>
              <div style={{ fontSize: '17pt', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '3mm' }}>
                付款通知單
              </div>
              {isCreditNote && (
                <div style={{ fontSize: '10pt', color: '#c0392b', fontWeight: 'bold', marginBottom: '2mm' }}>
                  （含折讓）
                </div>
              )}
              <table style={{ marginLeft: 'auto', fontSize: '8.5pt', borderCollapse: 'collapse' }}>
                <tbody>
                  <MetaRow label="通知單號" value={voucher.voucherNo} />
                  <MetaRow label="日期" value={fmtDate(voucher.createdAt)} />
                  {invoiceNo && <MetaRow label="供應商發票號" value={invoiceNo} />}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 收受方資訊 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4mm' }}>
        <tbody>
          <tr>
            <td style={{ width: '48%', verticalAlign: 'top', border: '1px solid #ccc', padding: '3mm', fontSize: '8.5pt' }}>
              <div style={{ fontWeight: 'bold', fontSize: '7.5pt', color: '#666', textTransform: 'uppercase', marginBottom: '1mm' }}>付款予</div>
              <div style={{ fontWeight: 'bold', fontSize: '10pt' }}>{supplier.name}</div>
              {supplier.shortName && supplier.shortName !== supplier.name && (
                <div style={{ color: '#666' }}>{supplier.shortName}</div>
              )}
              {supplier.taxId && <div style={{ color: '#444' }}>統編：{supplier.taxId}</div>}
              {supplier.address && <div style={{ color: '#444' }}>{supplier.address}</div>}
              {supplier.city && <div style={{ color: '#444' }}>{supplier.city}</div>}
              {supplier.contactPerson && <div style={{ color: '#444' }}>聯絡人：{supplier.contactPerson}</div>}
            </td>
            <td style={{ width: '4%' }} />
            <td style={{ width: '48%', verticalAlign: 'top', border: '1px solid #ccc', padding: '3mm', fontSize: '8.5pt' }}>
              <div style={{ fontWeight: 'bold', fontSize: '7.5pt', color: '#666', textTransform: 'uppercase', marginBottom: '1mm' }}>付款方</div>
              <div style={{ fontWeight: 'bold' }}>{company?.nameZh || company?.nameEn || ''}</div>
              {company?.nameEn && company?.nameZh && (
                <div style={{ color: '#666' }}>{company.nameEn}</div>
              )}
              {company?.taxId && <div style={{ color: '#444' }}>統編：{company.taxId}</div>}
              {company?.bankName && <div style={{ color: '#444', marginTop: '1mm' }}>銀行：{company.bankName}</div>}
              {company?.bankAccount && <div style={{ color: '#444' }}>帳號：{company.bankAccount}</div>}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 採購單明細 */}
      <table style={{ ...tableStyle, marginBottom: '3mm' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle }}>採購單號</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>交易條款</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>採購金額（含稅）</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td style={tdStyle}>{item.poNo ?? `#${item.payableId}`}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <span style={{
                  fontSize: '7.5pt',
                  padding: '0.5mm 2mm',
                  borderRadius: '3px',
                  backgroundColor: item.tradeTerms?.toUpperCase().startsWith('FOB') ? '#dbeafe' : '#f3f4f6',
                  color: item.tradeTerms?.toUpperCase().startsWith('FOB') ? '#1d4ed8' : '#374151',
                  fontWeight: 'bold',
                }}>
                  {item.tradeTerms ?? '—'}
                </span>
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                {fmtTWD(item.amountTWD)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 調整明細（含 FOB 折讓）*/}
      {adjustments.length > 0 && (
        <table style={{ ...tableStyle, marginBottom: '3mm' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle }} colSpan={2}>調整項目</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>金額</th>
            </tr>
          </thead>
          <tbody>
            {adjustments.map(a => (
              <tr key={a.id}>
                <td style={{ ...tdStyle, width: '60%' }}>
                  {a.name}
                  {a.category === 'LOGISTICS' && Number(a.amountTWD) < 0 && (
                    <span style={{ fontSize: '7.5pt', color: '#c0392b', marginLeft: '2mm' }}>（代墊扣款）</span>
                  )}
                </td>
                <td style={{ ...tdStyle, color: '#666', fontSize: '8pt' }}>{a.note ?? ''}</td>
                <td style={{
                  ...tdStyle, textAlign: 'right', fontFamily: 'monospace',
                  color: Number(a.amountTWD) < 0 ? '#c0392b' : '#000',
                  fontWeight: Number(a.amountTWD) < 0 ? 'bold' : 'normal',
                }}>
                  {Number(a.amountTWD) < 0
                    ? `− NT$ ${Math.round(Math.abs(Number(a.amountTWD))).toLocaleString()}`
                    : fmtTWD(Number(a.amountTWD))
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 金額合計 */}
      <table style={{ ...tableStyle, marginBottom: '8mm' }}>
        <tbody>
          <tr style={{ borderTop: '1px solid #ccc' }}>
            <td style={{ padding: '1.5mm 3mm', color: '#555' }}>採購小計</td>
            <td style={{ padding: '1.5mm 3mm', textAlign: 'right', fontFamily: 'monospace' }}>
              {fmtTWD(totals.subtotalTWD)}
            </td>
          </tr>
          {totals.adjustmentTWD !== 0 && (
            <tr>
              <td style={{ padding: '1.5mm 3mm', color: '#555' }}>調整合計</td>
              <td style={{
                padding: '1.5mm 3mm', textAlign: 'right', fontFamily: 'monospace',
                color: totals.adjustmentTWD < 0 ? '#c0392b' : '#000',
              }}>
                {totals.adjustmentTWD < 0
                  ? `− NT$ ${Math.round(Math.abs(totals.adjustmentTWD)).toLocaleString()}`
                  : fmtTWD(totals.adjustmentTWD)
                }
              </td>
            </tr>
          )}
          <tr style={{ borderTop: '1px solid #e5e7eb' }}>
            <td style={{ padding: '1.5mm 3mm', color: '#555' }}>應付小計</td>
            <td style={{ padding: '1.5mm 3mm', textAlign: 'right', fontFamily: 'monospace' }}>
              {fmtTWD(totals.afterAdjustmentTWD)}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '1.5mm 3mm', color: '#555' }}>營業稅 {totals.vatPct}%</td>
            <td style={{ padding: '1.5mm 3mm', textAlign: 'right', fontFamily: 'monospace' }}>
              {fmtTWD(totals.vatTWD)}
            </td>
          </tr>
          <tr style={{ borderTop: '2px solid #1a4a2e', backgroundColor: '#f9fafb' }}>
            <td style={{ padding: '2mm 3mm', fontWeight: 'bold', fontSize: '11pt' }}>實付總計</td>
            <td style={{ padding: '2mm 3mm', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '11pt' }}>
              {fmtTWD(totals.totalTWD)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 折讓說明框（有 FOB 代墊或佣金時顯示）*/}
      {isCreditNote && (
        <div style={{
          border: '1.5px solid #c0392b',
          borderRadius: '4px',
          padding: '4mm',
          marginBottom: '6mm',
          fontSize: '8.5pt',
          backgroundColor: '#fff5f5',
        }}>
          <div style={{ fontWeight: 'bold', color: '#c0392b', marginBottom: '2mm', fontSize: '10pt' }}>
            折讓說明（供核銷用）
          </div>
          <div style={{ color: '#444', lineHeight: '1.7' }}>
            {/* 佣金說明 */}
            {totals.commissionDeductionTWD !== 0 && (
              <p>
                依雙方議定之佣金條件，本次付款金額扣除佣金（不含稅）
                共計 <strong style={{ color: '#c0392b' }}>{fmtTWD(Math.abs(totals.commissionDeductionTWD))}</strong>。
              </p>
            )}
            {/* FOB 代墊說明 */}
            {totals.fobDeductionTWD !== 0 && (
              <p style={totals.commissionDeductionTWD !== 0 ? { marginTop: '1.5mm' } : undefined}>
                本批採購條件為 <strong>FOB</strong>，國內段報關/運費等由貴方負擔，
                惟由本公司代墊，共計 <strong style={{ color: '#c0392b' }}>{fmtTWD(Math.abs(totals.fobDeductionTWD))}</strong>，
                依材積比例分攤後自本通知單扣除。
              </p>
            )}
            <p style={{ marginTop: '2mm' }}>
              以上折讓金額（不含稅）合計 <strong style={{ color: '#c0392b' }}>
                {fmtTWD(Math.abs(totals.fobDeductionTWD) + Math.abs(totals.commissionDeductionTWD))}
              </strong>，請依此開立折讓單向主管稅務機關核銷。如有疑問，請聯絡本公司。
            </p>
          </div>
        </div>
      )}

      {/* 備註 */}
      {voucher.note && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '3px', padding: '3mm', marginBottom: '6mm', fontSize: '8.5pt' }}>
          <div style={{ fontWeight: 'bold', color: '#555', marginBottom: '1mm', fontSize: '7.5pt', textTransform: 'uppercase' }}>備註</div>
          <div style={{ whiteSpace: 'pre-wrap', color: '#333' }}>{voucher.note}</div>
        </div>
      )}

      {/* 簽名欄 */}
      <div style={{ pageBreakInside: 'avoid', marginTop: '10mm' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt' }}>
          <tbody>
            <tr>
              <td style={{ width: '45%', borderTop: '1px solid #000', paddingTop: '1mm', textAlign: 'center' }}>
                <div style={{ color: '#555', fontSize: '7.5pt' }}>付款方簽章</div>
                <div style={{ height: '15mm' }} />
                <div style={{ fontWeight: 'bold' }}>{company?.nameZh || company?.nameEn || ''}</div>
              </td>
              <td style={{ width: '10%' }} />
              <td style={{ width: '45%', borderTop: '1px solid #000', paddingTop: '1mm', textAlign: 'center' }}>
                <div style={{ color: '#555', fontSize: '7.5pt' }}>供應商簽章確認</div>
                <div style={{ height: '15mm' }} />
                <div style={{ fontWeight: 'bold' }}>{supplier.name}</div>
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
      <td style={{ color: '#666', paddingRight: '3mm', paddingBottom: '0.5mm', whiteSpace: 'nowrap', fontSize: '8.5pt' }}>{label}：</td>
      <td style={{ fontWeight: 'bold', paddingBottom: '0.5mm' }}>{value}</td>
    </tr>
  )
}
