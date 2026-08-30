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
    supplierInvoicePrefix: string | null
    supplierInvoiceDate: string | null
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

// 折讓證明的每一列發票資料
type InvoiceRow = {
  id: string
  prefix: string       // 字軌
  no: string           // 號碼
  year: string         // ROC 年
  month: string        // 月
  day: string          // 日
  amountExclTax: string  // 金額（不含稅），string 以支援 input
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTWD(n: number) {
  return `NT$ ${Math.round(n).toLocaleString()}`
}

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
}

function todayROC() {
  const d = new Date()
  return { year: (d.getFullYear() - 1911).toString(), month: (d.getMonth() + 1).toString(), day: d.getDate().toString() }
}

function newRow(defaults: Partial<InvoiceRow> = {}): InvoiceRow {
  const t = todayROC()
  return {
    id: Math.random().toString(36).slice(2, 9),
    prefix: '', no: '',
    year: t.year, month: t.month, day: t.day,
    amountExclTax: '0',
    ...defaults,
  }
}

const STATUS_ZH: Record<string, string> = {
  DRAFT: '草稿', SENT: '已寄出', CONFIRMED: '供應商已確認', PAID: '已付款',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrintPVPage() {
  const { voucherId } = useParams<{ voucherId: string }>()
  const [data, setData] = useState<PVData | null>(null)
  const [loading, setLoading] = useState(true)

  // 折讓證明列表（多列，每列對應一張供應商統一發票）
  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>([])

  // Email modal
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailMsg, setEmailMsg] = useState('')

  const sealManager = useSealManager()
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/print/pv/${voucherId}`)
      .then(r => r.json())
      .then((d: PVData) => {
        setData(d)
        document.title = `付款通知單 ${d.voucher.voucherNo}`

        // 初始化折讓列（折讓金額 = FOB扣款 + 佣金，預設一列）
        const deductionTotal = Math.abs(d.totals.fobDeductionTWD) + Math.abs(d.totals.commissionDeductionTWD)
        const t = todayROC()
        const initDate = d.voucher.supplierInvoiceDate
          ? (() => {
              const dt = new Date(d.voucher.supplierInvoiceDate!)
              return { year: (dt.getFullYear() - 1911).toString(), month: (dt.getMonth() + 1).toString(), day: dt.getDate().toString() }
            })()
          : t
        setInvoiceRows([newRow({
          prefix: d.voucher.supplierInvoicePrefix ?? '',
          no: d.voucher.supplierInvoiceNo ?? '',
          year: initDate.year, month: initDate.month, day: initDate.day,
          amountExclTax: Math.round(deductionTotal).toString(),
        })])
        setLoading(false)
      })
  }, [voucherId])

  // 儲存第一列的字軌/號碼/日期回 DB（以便下次重新開啟時預填）
  const savePrimaryRow = useCallback(async (row: InvoiceRow) => {
    try {
      const isoDate = row.year && row.month && row.day
        ? new Date(Number(row.year) + 1911, Number(row.month) - 1, Number(row.day)).toISOString()
        : undefined
      await fetch(`/api/finance/payment-vouchers/${voucherId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierInvoiceNo: row.no || null,
          supplierInvoicePrefix: row.prefix || null,
          supplierInvoiceDate: isoDate ?? null,
        }),
      })
    } catch { /* silent */ }
  }, [voucherId])

  const handleClose = useCallback(() => {
    if (window.history.length > 1) window.history.back()
    else window.close()
  }, [])

  function updateRow(id: string, patch: Partial<InvoiceRow>) {
    setInvoiceRows(prev => {
      const next = prev.map(r => r.id === id ? { ...r, ...patch } : r)
      if (next[0]?.id === id) savePrimaryRow(next[0])
      return next
    })
  }

  function addInvoiceRow() {
    setInvoiceRows(prev => [...prev, newRow({ year: prev[0]?.year, month: prev[0]?.month, day: prev[0]?.day })])
  }

  function removeInvoiceRow(id: string) {
    setInvoiceRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev)
  }

  async function sendEmail() {
    setEmailSending(true)
    setEmailMsg('')
    try {
      const res = await fetch(`/api/finance/payment-vouchers/${voucherId}/send-email`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '寄送失敗')
      setEmailMsg(`✓ 已寄出至 ${data?.supplier.email}`)
      setShowEmailModal(false)
    } catch (err) {
      setEmailMsg(err instanceof Error ? err.message : '寄送失敗')
    } finally {
      setEmailSending(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">載入中...</div>
  if (!data) return <div className="flex items-center justify-center h-screen text-red-500">找不到此付款通知單</div>

  const { voucher, supplier, company, items, adjustments, totals } = data
  const isCreditNote = totals.fobDeductionTWD !== 0 || totals.commissionDeductionTWD !== 0
  const deductionExclTax = Math.abs(totals.fobDeductionTWD) + Math.abs(totals.commissionDeductionTWD)
  const vatPct = totals.vatPct

  // Email 預覽文字
  const emailPreviewLines = [
    `收件人：${supplier.email ?? '（無 Email）'}`,
    `主旨：【付款通知單 ${voucher.voucherNo}】請確認付款金額`,
    '',
    `${supplier.contactPerson ? `${supplier.contactPerson} 您好，` : '您好，'}`,
    '',
    '茲通知本次付款金額如下：',
    ...items.map(i => `  ${i.poNo ?? `#${i.payableId}`}  NT$ ${Math.round(i.amountTWD).toLocaleString()}`),
    ...(adjustments.length ? ['  ─', ...adjustments.map(a => `  ${a.name}：NT$ ${Math.round(Number(a.amountTWD)).toLocaleString()}`)] : []),
    '',
    `實付總計（含稅）：NT$ ${Math.round(totals.totalTWD).toLocaleString()}`,
  ]

  return (
    <>
      {/* ── 工具列 ── */}
      <div className="no-print bg-gray-800 text-white px-5 py-2.5 flex items-center gap-3 text-sm flex-wrap">
        <button onClick={handleClose} className="text-gray-300 hover:text-white">← 返回</button>
        <span className="text-gray-600">|</span>
        <span className="text-gray-300 font-mono">{voucher.voucherNo}</span>
        <span className="text-gray-400">{STATUS_ZH[voucher.status] ?? voucher.status}</span>
        {isCreditNote && <span className="text-xs bg-orange-700 text-white px-2 py-0.5 rounded">含折讓</span>}
        {isCreditNote && <span className="text-xs text-amber-300">↓ 折讓證明欄位請在下方表格直接編輯</span>}
        <div className="ml-auto flex gap-2">
          {supplier.email && (
            <button onClick={() => { setShowEmailModal(true); setEmailMsg('') }}
              className="bg-gray-600 text-white px-4 py-1.5 rounded hover:bg-gray-500">
              ✉ 寄 Email
            </button>
          )}
          <button onClick={() => window.print()} className="bg-blue-500 text-white px-4 py-1.5 rounded hover:bg-blue-600">
            🖨 列印 / 儲存 PDF
          </button>
        </div>
      </div>

      {/* ── Email Modal ── */}
      {showEmailModal && (
        <div className="no-print fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <h3 className="font-bold text-lg text-gray-800 mb-4">✉ Email 預覽</h3>
            <div className="space-y-1 text-sm text-gray-700">
              {emailPreviewLines.map((line, i) =>
                line === '' ? <div key={i} className="h-2" /> :
                <div key={i} className={line.startsWith('收件') || line.startsWith('主旨') ? 'font-medium' : ''}>{line}</div>
              )}
            </div>
            {emailMsg && <p className="text-sm mt-3 text-red-500">{emailMsg}</p>}
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => { setShowEmailModal(false); setEmailMsg('') }}
                className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">取消</button>
              <button onClick={sendEmail} disabled={emailSending || !supplier.email}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-sm">
                {emailSending ? '寄送中...' : '確認寄送'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 側邊欄 ── */}
      <div className="no-print flex" style={{ minHeight: 'calc(100vh - 44px)' }}>
        <aside className="w-56 bg-white border-r border-gray-200 p-4 flex-shrink-0 overflow-y-auto">
          <SealSidebarSection manager={sealManager} selectedTemplateId="builtin" />
        </aside>

        <main className="flex-1 bg-gray-200 py-8 px-6 overflow-auto">
          {/* 付款通知單預覽 */}
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
            <PVDocument data={data} />
            <SealOverlayLayer manager={sealManager} containerRef={previewRef} />
          </div>

          {/* 折讓證明預覽（可直接在表格裡編輯） */}
          {isCreditNote && (
            <>
              <div className="no-print mt-4 mb-2 flex items-center gap-3">
                <span className="text-sm text-gray-600 font-medium">折讓證明 — 供應商發票明細</span>
                <button onClick={addInvoiceRow}
                  className="text-xs px-2.5 py-1 rounded border border-teal-400 text-teal-700 hover:bg-teal-50">
                  + 新增一列（多張發票）
                </button>
                <span className="text-xs text-gray-400">總折讓金額（不含稅）：NT$ {invoiceRows.reduce((s, r) => s + (Number(r.amountExclTax) || 0), 0).toLocaleString()}</span>
              </div>
              <div className="print-page bg-white mx-auto shadow-lg">
                <CreditNoteDocument
                  data={data}
                  invoiceRows={invoiceRows}
                  vatPct={vatPct}
                  onChangeRows={{ update: updateRow, remove: removeInvoiceRow }}
                />
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── 列印層 ── */}
      <div className="print-only" style={{ position: 'relative' }}>
        <PVDocument data={data} />
        <SealPrintLayer manager={sealManager} />
        {isCreditNote && (
          <div style={{ pageBreakBefore: 'always' }}>
            <CreditNoteDocument
              data={data}
              invoiceRows={invoiceRows}
              vatPct={vatPct}
            />
          </div>
        )}
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
        .cn-input {
          border: none; background: transparent;
          font-family: inherit; font-size: inherit; color: inherit;
          text-align: inherit; width: 100%; padding: 0;
        }
        .cn-input:focus { outline: 1px dashed #3b82f6; background: #eff6ff; }
        @media print { .cn-input { outline: none !important; background: transparent !important; } }
      `}</style>
    </>
  )
}

// ─── 付款通知單 ───────────────────────────────────────────────────────────────

function PVDocument({ data }: { data: PVData }) {
  const { voucher, supplier, company, items, adjustments, totals } = data
  const isCreditNote = totals.fobDeductionTWD !== 0 || totals.commissionDeductionTWD !== 0

  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }
  const thStyle: React.CSSProperties = { backgroundColor: '#1a4a2e', color: '#fff', padding: '2mm 3mm', textAlign: 'left', fontWeight: 'normal' }
  const tdStyle: React.CSSProperties = { padding: '1.5mm 3mm', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' }

  return (
    <div style={{ fontFamily: 'Arial, "Noto Sans TC", sans-serif', fontSize: '9pt', color: '#000' }}>
      {/* 頁首 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '5mm' }}>
        <tbody><tr>
          <td style={{ verticalAlign: 'top', width: '55%' }}>
            {company?.logoBase64 && <img src={company.logoBase64} alt="logo" style={{ maxHeight: '55px', maxWidth: '160px', objectFit: 'contain', marginBottom: '2mm' }} />}
            <div style={{ fontWeight: 'bold', fontSize: '12pt' }}>{company?.nameZh || company?.nameEn || ''}</div>
            {company?.nameEn && company?.nameZh && <div style={{ color: '#555', fontSize: '8pt', marginBottom: '1mm' }}>{company.nameEn}</div>}
            <div style={{ fontSize: '8pt', color: '#444', lineHeight: '1.6' }}>
              {company?.addressZh && <div>{company.addressZh}</div>}
              {company?.phone && <div>Tel: {company.phone}</div>}
              {company?.fax && <div>Fax: {company.fax}</div>}
              {company?.taxId && <div>統編：{company.taxId}</div>}
            </div>
          </td>
          <td style={{ verticalAlign: 'top', textAlign: 'right', width: '45%' }}>
            <div style={{ fontSize: '17pt', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '3mm' }}>付款通知單</div>
            {isCreditNote && <div style={{ fontSize: '10pt', color: '#c0392b', fontWeight: 'bold', marginBottom: '2mm' }}>（含折讓）</div>}
            <table style={{ marginLeft: 'auto', fontSize: '8.5pt', borderCollapse: 'collapse' }}>
              <tbody>
                <MetaRow label="通知單號" value={voucher.voucherNo} />
                <MetaRow label="日期" value={fmtDate(voucher.createdAt)} />
              </tbody>
            </table>
          </td>
        </tr></tbody>
      </table>

      {/* 付款予 / 付款方 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4mm' }}>
        <tbody><tr>
          <td style={{ width: '48%', verticalAlign: 'top', border: '1px solid #ccc', padding: '3mm', fontSize: '8.5pt' }}>
            <div style={{ fontWeight: 'bold', fontSize: '7.5pt', color: '#666', textTransform: 'uppercase', marginBottom: '1mm' }}>付款予</div>
            <div style={{ fontWeight: 'bold', fontSize: '10pt' }}>{supplier.name}</div>
            {supplier.shortName && supplier.shortName !== supplier.name && <div style={{ color: '#666' }}>{supplier.shortName}</div>}
            {supplier.taxId && <div style={{ color: '#444' }}>統編：{supplier.taxId}</div>}
            {supplier.address && <div style={{ color: '#444' }}>{supplier.address}</div>}
            {supplier.city && <div style={{ color: '#444' }}>{supplier.city}</div>}
            {supplier.contactPerson && <div style={{ color: '#444' }}>聯絡人：{supplier.contactPerson}</div>}
          </td>
          <td style={{ width: '4%' }} />
          <td style={{ width: '48%', verticalAlign: 'top', border: '1px solid #ccc', padding: '3mm', fontSize: '8.5pt' }}>
            <div style={{ fontWeight: 'bold', fontSize: '7.5pt', color: '#666', textTransform: 'uppercase', marginBottom: '1mm' }}>付款方</div>
            <div style={{ fontWeight: 'bold' }}>{company?.nameZh || company?.nameEn || ''}</div>
            {company?.nameEn && company?.nameZh && <div style={{ color: '#666' }}>{company.nameEn}</div>}
            {company?.taxId && <div style={{ color: '#444' }}>統編：{company.taxId}</div>}
            {company?.bankName && <div style={{ color: '#444', marginTop: '1mm' }}>銀行：{company.bankName}</div>}
            {company?.bankAccount && <div style={{ color: '#444' }}>帳號：{company.bankAccount}</div>}
          </td>
        </tr></tbody>
      </table>

      {/* 採購單明細 */}
      <table style={{ ...tableStyle, marginBottom: '3mm' }}>
        <thead><tr>
          <th style={thStyle}>採購單號</th>
          <th style={{ ...thStyle, textAlign: 'center' }}>交易條款</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>採購金額（含稅）</th>
        </tr></thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td style={tdStyle}>{item.poNo ?? `#${item.payableId}`}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <span style={{
                  fontSize: '7.5pt', padding: '0.5mm 2mm', borderRadius: '3px',
                  backgroundColor: item.tradeTerms?.toUpperCase().startsWith('FOB') ? '#dbeafe' : '#f3f4f6',
                  color: item.tradeTerms?.toUpperCase().startsWith('FOB') ? '#1d4ed8' : '#374151',
                  fontWeight: 'bold',
                }}>{item.tradeTerms ?? '—'}</span>
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>{fmtTWD(item.amountTWD)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 調整明細 */}
      {adjustments.length > 0 && (
        <table style={{ ...tableStyle, marginBottom: '3mm' }}>
          <thead><tr>
            <th style={thStyle} colSpan={2}>調整項目</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>金額</th>
          </tr></thead>
          <tbody>
            {adjustments.map(a => (
              <tr key={a.id}>
                <td style={{ ...tdStyle, width: '60%' }}>{a.name}</td>
                <td style={{ ...tdStyle, color: '#666', fontSize: '8pt' }}>{a.note ?? ''}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', color: Number(a.amountTWD) < 0 ? '#c0392b' : '#000', fontWeight: Number(a.amountTWD) < 0 ? 'bold' : 'normal' }}>
                  {Number(a.amountTWD) < 0 ? `− NT$ ${Math.round(Math.abs(Number(a.amountTWD))).toLocaleString()}` : fmtTWD(Number(a.amountTWD))}
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
            <td style={{ padding: '1.5mm 3mm', textAlign: 'right', fontFamily: 'monospace' }}>{fmtTWD(totals.subtotalTWD)}</td>
          </tr>
          {totals.adjustmentTWD !== 0 && (
            <tr>
              <td style={{ padding: '1.5mm 3mm', color: '#555' }}>調整合計</td>
              <td style={{ padding: '1.5mm 3mm', textAlign: 'right', fontFamily: 'monospace', color: totals.adjustmentTWD < 0 ? '#c0392b' : '#000' }}>
                {totals.adjustmentTWD < 0 ? `− NT$ ${Math.round(Math.abs(totals.adjustmentTWD)).toLocaleString()}` : fmtTWD(totals.adjustmentTWD)}
              </td>
            </tr>
          )}
          <tr style={{ borderTop: '1px solid #e5e7eb' }}>
            <td style={{ padding: '1.5mm 3mm', color: '#555' }}>應付小計</td>
            <td style={{ padding: '1.5mm 3mm', textAlign: 'right', fontFamily: 'monospace' }}>{fmtTWD(totals.afterAdjustmentTWD)}</td>
          </tr>
          <tr>
            <td style={{ padding: '1.5mm 3mm', color: '#555' }}>營業稅 {totals.vatPct}%</td>
            <td style={{ padding: '1.5mm 3mm', textAlign: 'right', fontFamily: 'monospace' }}>{fmtTWD(totals.vatTWD)}</td>
          </tr>
          <tr style={{ borderTop: '2px solid #1a4a2e', backgroundColor: '#f9fafb' }}>
            <td style={{ padding: '2mm 3mm', fontWeight: 'bold', fontSize: '11pt' }}>實付總計</td>
            <td style={{ padding: '2mm 3mm', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '11pt' }}>{fmtTWD(totals.totalTWD)}</td>
          </tr>
        </tbody>
      </table>

      {/* 折讓說明框 */}
      {isCreditNote && (
        <div style={{ border: '1.5px solid #c0392b', borderRadius: '4px', padding: '4mm', marginBottom: '6mm', fontSize: '8.5pt', backgroundColor: '#fff5f5' }}>
          <div style={{ fontWeight: 'bold', color: '#c0392b', marginBottom: '2mm', fontSize: '10pt' }}>折讓說明（供核銷用）</div>
          <div style={{ color: '#444', lineHeight: '1.7' }}>
            {totals.commissionDeductionTWD !== 0 && (
              <p>依雙方議定之佣金條件，本次付款金額扣除佣金（稅前）共計 <strong style={{ color: '#c0392b' }}>{fmtTWD(Math.abs(totals.commissionDeductionTWD))}</strong>。</p>
            )}
            {totals.fobDeductionTWD !== 0 && (
              <p>本批採購條件為 <strong>FOB</strong>，國內段報關/運費由貴方負擔，惟由本公司代墊，共計 <strong style={{ color: '#c0392b' }}>{fmtTWD(Math.abs(totals.fobDeductionTWD))}</strong>，依材積比例分攤後自本通知單扣除。</p>
            )}
            <p style={{ marginTop: '2mm' }}>
              以上折讓金額（稅前）合計 <strong style={{ color: '#c0392b' }}>{fmtTWD(Math.abs(totals.fobDeductionTWD) + Math.abs(totals.commissionDeductionTWD))}</strong>，請依此開立折讓單向主管稅務機關核銷。
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
          <tbody><tr>
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
          </tr></tbody>
        </table>
      </div>
    </div>
  )
}

// ─── 折讓證明單（兩聯）────────────────────────────────────────────────────────

type ChangeHandlers = {
  update: (id: string, patch: Partial<InvoiceRow>) => void
  remove: (id: string) => void
}

type CreditNoteProps = {
  data: PVData
  invoiceRows: InvoiceRow[]
  vatPct: number
  onChangeRows?: ChangeHandlers   // undefined = print mode（不顯示 input）
}

function CreditNoteDocument({ data, invoiceRows, vatPct, onChangeRows }: CreditNoteProps) {
  const { supplier, company } = data
  const totalExclTax = invoiceRows.reduce((s, r) => s + (Number(r.amountExclTax) || 0), 0)
  const totalVat = Math.round(totalExclTax * vatPct / 100)
  const today = todayROC()

  return (
    <div style={{ fontFamily: '"Noto Sans TC", Arial, sans-serif', fontSize: '9pt', color: '#000' }}>
      <CreditNoteCopy copy="第一聯：交付原銷貨人作為銷項稅額之扣減憑證"
        supplier={supplier} company={company} invoiceRows={invoiceRows} vatPct={vatPct}
        totalExclTax={totalExclTax} totalVat={totalVat} today={today} onChangeRows={onChangeRows} />
      <div style={{ borderTop: '1px dashed #999', margin: '5mm 0', textAlign: 'center', fontSize: '7.5pt', color: '#999' }}>✂ 沿虛線剪開</div>
      <CreditNoteCopy copy="第二聯：交付原銷貨人作為記帳憑證"
        supplier={supplier} company={company} invoiceRows={invoiceRows} vatPct={vatPct}
        totalExclTax={totalExclTax} totalVat={totalVat} today={today} onChangeRows={onChangeRows} />
    </div>
  )
}

type CopyProps = {
  copy: string
  supplier: PVData['supplier']
  company: PVData['company']
  invoiceRows: InvoiceRow[]
  vatPct: number
  totalExclTax: number
  totalVat: number
  today: { year: string; month: string; day: string }
  onChangeRows?: ChangeHandlers
}

function InlineCell({ row, field, onUpdate, style }: {
  row: InvoiceRow
  field: keyof InvoiceRow
  onUpdate?: (id: string, patch: Partial<InvoiceRow>) => void
  style?: React.CSSProperties
}) {
  if (!onUpdate) return <span style={style}>{row[field]}</span>
  return (
    <input
      className="cn-input"
      value={row[field]}
      style={style}
      onChange={e => onUpdate(row.id, { [field]: e.target.value })}
    />
  )
}

function CreditNoteCopy({ copy, supplier, company, invoiceRows, vatPct, totalExclTax, totalVat, today, onChangeRows }: CopyProps) {
  const isEditable = !!onChangeRows
  const cellStyle: React.CSSProperties = { border: '1px solid #000', padding: '1mm 1.5mm', fontSize: '8pt', verticalAlign: 'middle' }
  const hCell: React.CSSProperties = { ...cellStyle, backgroundColor: '#f0f0f0', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '7.5pt' }

  return (
    <div style={{ border: '1.5px solid #000', padding: '4mm', pageBreakInside: 'avoid' }}>
      {/* 頭部：發票人 + 標題 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '3mm' }}>
        <tbody><tr>
          <td style={{ verticalAlign: 'top', width: '50%', fontSize: '8pt', lineHeight: '1.7' }}>
            <div><strong>原發開票立單銷位貨人</strong></div>
            <div>名　　稱：{supplier.name}</div>
            <div>統一編號：{supplier.taxId ?? '（請填入）'}</div>
            {supplier.address && <div style={{ fontSize: '7.5pt', color: '#444' }}>地　　址：{supplier.address}{supplier.city ? ` ${supplier.city}` : ''}</div>}
          </td>
          <td style={{ verticalAlign: 'top', textAlign: 'center', width: '50%' }}>
            <div style={{ fontWeight: 'bold', fontSize: '11pt', letterSpacing: '0.5px', marginBottom: '1mm' }}>
              營業人銷貨退回進料退出或折讓證明單
            </div>
            <div style={{ fontSize: '8.5pt' }}>
              中華民國　{today.year}　年　{today.month}　月　{today.day}　日
            </div>
            <div style={{ fontSize: '7pt', color: '#555', marginTop: '1mm' }}>{copy}</div>
          </td>
        </tr></tbody>
      </table>

      {/* 明細表格 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '3mm' }}>
        <thead>
          <tr>
            <th colSpan={6} style={{ ...hCell, borderBottom: 'none' }}>開立發票</th>
            <th colSpan={4} style={{ ...hCell, borderBottom: 'none' }}>退貨或折讓內容</th>
            <th rowSpan={2} style={{ ...hCell, width: '8%' }}>應稅<br/>打V</th>
            {isEditable && <th rowSpan={2} style={{ ...hCell, width: '5%' }} />}
          </tr>
          <tr>
            <th style={{ ...hCell, width: '5%' }}>聯式</th>
            <th style={{ ...hCell, width: '8%' }}>年</th>
            <th style={{ ...hCell, width: '5%' }}>月</th>
            <th style={{ ...hCell, width: '5%' }}>日</th>
            <th style={{ ...hCell, width: '8%' }}>字軌</th>
            <th style={{ ...hCell, width: '14%' }}>號碼</th>
            <th style={{ ...hCell, width: '8%' }}>品名</th>
            <th style={{ ...hCell, width: '5%' }}>數量</th>
            <th style={{ ...hCell, width: '12%' }}>金額（不含稅）</th>
            <th style={{ ...hCell, width: '10%' }}>營業稅額</th>
          </tr>
        </thead>
        <tbody>
          {invoiceRows.map((row) => {
            const amt = Number(row.amountExclTax) || 0
            const vat = Math.round(amt * vatPct / 100)
            return (
              <tr key={row.id}>
                <td style={{ ...cellStyle, textAlign: 'center' }}>3</td>
                <td style={{ ...cellStyle, textAlign: 'center' }}><InlineCell row={row} field="year" onUpdate={onChangeRows?.update} /></td>
                <td style={{ ...cellStyle, textAlign: 'center' }}><InlineCell row={row} field="month" onUpdate={onChangeRows?.update} /></td>
                <td style={{ ...cellStyle, textAlign: 'center' }}><InlineCell row={row} field="day" onUpdate={onChangeRows?.update} /></td>
                <td style={{ ...cellStyle, textAlign: 'center', fontFamily: 'monospace' }}><InlineCell row={row} field="prefix" onUpdate={onChangeRows?.update} /></td>
                <td style={{ ...cellStyle, fontFamily: 'monospace' }}><InlineCell row={row} field="no" onUpdate={onChangeRows?.update} /></td>
                <td style={{ ...cellStyle, textAlign: 'center' }}>折讓</td>
                <td style={{ ...cellStyle, textAlign: 'center' }}>1</td>
                <td style={{ ...cellStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                  <InlineCell row={row} field="amountExclTax" onUpdate={onChangeRows?.update} style={{ textAlign: 'right' }} />
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', fontFamily: 'monospace' }}>{vat.toLocaleString()}</td>
                <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>V</td>
                {isEditable && (
                  <td style={{ ...cellStyle, textAlign: 'center', padding: '0' }}>
                    {invoiceRows.length > 1 && (
                      <button onClick={() => onChangeRows!.remove(row.id)}
                        style={{ color: '#999', fontSize: '14px', lineHeight: 1, padding: '2px 6px', cursor: 'pointer', background: 'none', border: 'none' }}
                        title="移除此列">×</button>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
          {/* 空白行 */}
          {Array.from({ length: Math.max(0, 3 - invoiceRows.length) }).map((_, i) => (
            <tr key={`blank-${i}`}>
              {Array(isEditable ? 12 : 11).fill(null).map((_, j) => (
                <td key={j} style={{ ...cellStyle, height: '5mm' }}>&nbsp;</td>
              ))}
            </tr>
          ))}
          {/* 合計 */}
          <tr style={{ backgroundColor: '#f9f9f9' }}>
            <td colSpan={8} style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>合　計</td>
            <td style={{ ...cellStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{Math.round(totalExclTax).toLocaleString()}</td>
            <td style={{ ...cellStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{totalVat.toLocaleString()}</td>
            <td style={cellStyle} />
            {isEditable && <td style={cellStyle} />}
          </tr>
        </tbody>
      </table>

      <div style={{ fontSize: '8pt', marginBottom: '3mm' }}>
        本證明單所列銷貨退回進貨退出或折讓，確屬事實，特此證明。
      </div>

      {/* 原進貨營業人 + 蓋章框（3:2，50mm×33mm） */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody><tr>
          <td style={{ verticalAlign: 'top', width: '55%', fontSize: '8pt', lineHeight: '1.8' }}>
            <div><strong>原進貨營業人（或原買受人）</strong></div>
            <div>名　　稱：{company?.nameZh || company?.nameEn || ''}</div>
            <div>統一編號：{company?.taxId ?? ''}</div>
            {company?.addressZh && <div style={{ fontSize: '7.5pt', color: '#444' }}>地　　址：{company.addressZh}</div>}
          </td>
          <td style={{ verticalAlign: 'top', textAlign: 'center', width: '45%', paddingLeft: '4mm' }}>
            <div style={{ fontSize: '7.5pt', color: '#555', marginBottom: '1mm' }}>蓋章</div>
            {/* 3:2 蓋章框，約 50mm × 33mm */}
            <div style={{
              display: 'inline-block',
              width: '50mm',
              height: '33mm',
              border: '1.5px solid #000',
              borderRadius: '2px',
            }} />
          </td>
        </tr></tbody>
      </table>
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
