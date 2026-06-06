/**
 * POST /api/parse-shipment-excel
 * 接收含 Invoice + PackingList 兩個 Tab 的 Excel（.xls / .xlsx），
 * 純程式解析（不依賴 AI），回傳結構化出貨資料供前端預覽確認。
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

interface ParsedItem {
  itemNo: string        // SKU / Item No
  description: string  // 完整描述（第一行）
  qty: number
  unit: string
  unitPrice: number | null   // 來自 Invoice
  currency: string
  amount: number | null      // 來自 Invoice
  netWeightKg: number | null // 來自 PackingList
  grossWeightKg: number | null
  cft: number | null         // 材積（Cu.Ft.）
  cartonNo: string | null
}

interface AdditionalCharge {
  description: string
  amount: number
  currency: string
}

export interface ParsedShipmentExcel {
  invoiceNo: string | null
  packingListNo: string | null
  orderNo: string | null
  shipmentDate: string | null   // YYYY-MM-DD
  soldTo: string | null
  deliverTo: string | null
  origin: string | null
  destination: string | null
  paymentTerms: string | null
  currency: string
  items: ParsedItem[]
  goodsTotal: number | null
  additionalCharges: AdditionalCharge[]
  totalAmount: number | null
  totalCartons: number | null
  totalNetWeightKg: number | null
  totalGrossWeightKg: number | null
  totalCft: number | null
  dimensions: string | null
  additionalInfo: string | null
}

// ── helpers ──────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = parseFloat(String(v).replace(/[^\d.\-]/g, ''))
  return isNaN(n) ? null : n
}

/** 從多行字串裡抓 "Item No. XXXXX" 後面的 ID */
function extractItemNo(text: string): string {
  const m = text.match(/Item\s+No\.\s*([A-Za-z0-9_\-]+)/i)
  if (m) return m[1].trim()
  return ''
}

/** 把 "2026/06/05" 或 "2026-06-05" 轉成 YYYY-MM-DD */
function parseDate(s: string): string | null {
  const m = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

// ── Invoice Tab parser ────────────────────────────────────────────────────────

function parseInvoice(rows: unknown[][]): Partial<ParsedShipmentExcel> & { items: ParsedItem[] } {
  const result: Partial<ParsedShipmentExcel> & { items: ParsedItem[] } = {
    items: [], additionalCharges: [], currency: 'USD',
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const c0 = str(row[0]); const c3 = str(row[3]); const c7 = str(row[7])

    // Invoice No（右上角，通常在 row 2 的 col 7）
    if (!result.invoiceNo && c7 && /^[A-Z]\d{6,}/.test(c7)) {
      result.invoiceNo = c7
    }

    // Order No（row 4 col 7 開頭有 E）
    if (!result.orderNo && c7 && /^E\d{5,}/.test(c7)) {
      result.orderNo = c7
    }

    // SOLD TO
    if (c0 === 'SOLD TO' && !result.soldTo) {
      result.soldTo = str(row[1]).split('\n')[0]
    }

    // DELIVER TO
    if (c0 === 'DELIVER TO' && !result.deliverTo) {
      result.deliverTo = str(row[1]).split('\n')[0]
    }

    // Shipment: 裡有日期 & 原產地 & 目的地
    if (c0 === 'Shipment:' && !result.shipmentDate) {
      const lines = str(row[1]).split('\n').map(l => l.trim()).filter(Boolean)
      // lines: [shipper, date, origin, destination]
      if (lines[1]) result.shipmentDate = parseDate(lines[1])
      if (lines[2]) result.origin = lines[2]
      if (lines[3]) result.destination = lines[3]
    }

    // Payment TERMS
    if (c0 === 'TERMS' && !result.paymentTerms) {
      result.paymentTerms = str(row[1]) || str(row[3])
    }

    // GOODS TOTAL
    if (c3.includes('GOODS TOTAL')) {
      result.goodsTotal = num(row[9]) ?? num(row[8])
      result.currency = str(row[8]) || str(row[7]) || result.currency!
    }

    // 附加費用（PLUS xxx）
    if (c3.startsWith('PLUS ') || c3.toLowerCase().includes('handling') || c3.toLowerCase().includes('charge')) {
      if (c3 !== 'GOODS TOTAL') {
        const amt = num(row[9]) ?? num(row[8])
        const cur = str(row[8]) || result.currency!
        if (amt != null) {
          result.additionalCharges!.push({ description: c3, amount: amt, currency: cur })
        }
      }
    }

    // Total 行（含總金額）
    if (c0 === 'Total:' && !result.totalAmount) {
      result.totalAmount = num(row[9])
      if (!result.currency) result.currency = str(row[8])
    }

    // 品項行：col0 = Item No（純數字/英數），col3 = 描述，col4 = qty，col5 = unit，col7 = price，col8 = currency，col9 = amount
    if (c0 && /^\d{5,}$/.test(c0) && str(row[3])) {
      const descLines = str(row[3]).split('\n').map(l => l.trim()).filter(Boolean)
      const description = descLines.filter(l => !l.startsWith("'Order No.")).join(' | ')
      result.items.push({
        itemNo: c0,
        description,
        qty: num(row[4]) ?? 0,
        unit: str(row[5]) || 'PCS',
        unitPrice: num(row[7]),
        currency: str(row[8]) || result.currency!,
        amount: num(row[9]),
        netWeightKg: null, grossWeightKg: null, cft: null, cartonNo: null,
      })
    }

    // Additional Info
    if (c0 === 'Additional Information:' || (i > 20 && c0 && result.totalAmount && !result.additionalInfo)) {
      const info = str(row[0]).replace('Additional Information:', '').trim()
        || str(rows[i + 1]?.[0])
      if (info && info.length > 5) result.additionalInfo = info
    }
  }

  return result
}

// ── PackingList Tab parser ────────────────────────────────────────────────────

function parsePackingList(rows: unknown[][]): Partial<ParsedShipmentExcel> & { plItems: Array<{ itemNo: string; qty: number; unit: string; netWeightKg: number | null; grossWeightKg: number | null; cft: number | null; cartonNo: string | null }> } {
  const result = {
    packingListNo: null as string | null,
    orderNo: null as string | null,
    totalCartons: null as number | null,
    totalNetWeightKg: null as number | null,
    totalGrossWeightKg: null as number | null,
    totalCft: null as number | null,
    dimensions: null as string | null,
    plItems: [] as Array<{ itemNo: string; qty: number; unit: string; netWeightKg: number | null; grossWeightKg: number | null; cft: number | null; cartonNo: string | null }>,
  }

  let currentCartonNo: string | null = null
  let currentItemNo: string | null = null

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const c0 = str(row[0]); const c2 = str(row[2]); const c3 = str(row[3])
    const c10 = str(row[10]); const c7 = str(row[7])

    // PL No（右上角）
    if (!result.packingListNo && str(row[10]) && /^[A-Z]\d{6,}/.test(str(row[10]))) {
      result.packingListNo = str(row[10])
    }

    // Order No
    if (!result.orderNo && str(row[10]) && /^E\d{5,}/.test(str(row[10]))) {
      result.orderNo = str(row[10])
    }

    // Item No 行（"Item No. XXXXX"）
    if (c3.startsWith('Item No.')) {
      currentItemNo = c3.replace('Item No.', '').trim()
      currentCartonNo = c0 || currentCartonNo
    }

    // 數據行（緊接在 Item No 行後，col5=qty, col9=net, col11=gross, col13=cft）
    if (currentItemNo && str(row[5]) && num(row[5]) != null && c3 && !c3.startsWith("'")) {
      const qty = num(row[5]) ?? 0
      const unit = str(row[7]) || 'PCS'
      const netKg = num(row[9])
      const grossKg = num(row[11])
      const cft = num(row[13])

      // 避免重複加
      const existing = result.plItems.find(p => p.itemNo === currentItemNo)
      if (!existing) {
        result.plItems.push({
          itemNo: currentItemNo,
          qty,
          unit,
          netWeightKg: netKg,
          grossWeightKg: grossKg,
          cft,
          cartonNo: currentCartonNo,
        })
      }
    }

    // Total CTNS
    if (c0 === 'Total:' && str(row[1]).includes('CTNS')) {
      const m = str(row[1]).match(/(\d+)\s*CTNS/)
      if (m) result.totalCartons = parseInt(m[1])
    }

    // Total weights (row with "Total:" and numeric weights)
    if (c0 === 'Total:' && num(row[9]) != null && !str(row[1]).includes('CTNS')) {
      result.totalNetWeightKg = num(row[9])
      result.totalGrossWeightKg = num(row[11])
      result.totalCft = num(row[13])
    }

    // Dimensions / Additional Info
    if (c0.match(/^L:\s*[\d.]+/)) {
      result.dimensions = c0.split('\n')[0].trim()
    }
  }

  return result
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: '請上傳 Excel 檔案' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xls', 'xlsx'].includes(ext ?? '')) {
      return NextResponse.json({ error: '請上傳 .xls 或 .xlsx 檔案' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const xlsx = await import('xlsx')
    const wb = xlsx.read(buf, { type: 'buffer' })

    // 找 Invoice 和 PackingList tab（不分大小寫）
    const invoiceSheet = wb.SheetNames.find(n => /invoice/i.test(n))
    const plSheet = wb.SheetNames.find(n => /packing/i.test(n))

    if (!invoiceSheet && !plSheet) {
      return NextResponse.json({ error: 'Excel 找不到 Invoice 或 PackingList 分頁' }, { status: 400 })
    }

    const toRows = (sheetName: string): unknown[][] => {
      const ws = wb.Sheets[sheetName]
      return xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
    }

    const invoiceData = invoiceSheet ? parseInvoice(toRows(invoiceSheet)) : { items: [], additionalCharges: [] }
    const plData = plSheet ? parsePackingList(toRows(plSheet)) : { plItems: [] }

    // 合併：把 PL 的重量/材積/箱號 合入 Invoice 品項
    const mergedItems: ParsedItem[] = invoiceData.items.map(it => {
      const pl = plData.plItems.find(p => p.itemNo === it.itemNo)
      return {
        ...it,
        netWeightKg: pl?.netWeightKg ?? null,
        grossWeightKg: pl?.grossWeightKg ?? null,
        cft: pl?.cft ?? null,
        cartonNo: pl?.cartonNo ?? null,
      }
    })

    // 若 PL 有 Invoice 沒有的品項，補進去
    for (const pl of plData.plItems) {
      if (!mergedItems.find(it => it.itemNo === pl.itemNo)) {
        mergedItems.push({
          itemNo: pl.itemNo,
          description: '',
          qty: pl.qty,
          unit: pl.unit,
          unitPrice: null,
          currency: invoiceData.currency ?? 'USD',
          amount: null,
          netWeightKg: pl.netWeightKg,
          grossWeightKg: pl.grossWeightKg,
          cft: pl.cft,
          cartonNo: pl.cartonNo,
        })
      }
    }

    const result: ParsedShipmentExcel = {
      invoiceNo: invoiceData.invoiceNo ?? plData.packingListNo ?? null,
      packingListNo: plData.packingListNo ?? invoiceData.invoiceNo ?? null,
      orderNo: invoiceData.orderNo ?? plData.orderNo ?? null,
      shipmentDate: invoiceData.shipmentDate ?? null,
      soldTo: invoiceData.soldTo ?? null,
      deliverTo: invoiceData.deliverTo ?? null,
      origin: invoiceData.origin ?? null,
      destination: invoiceData.destination ?? null,
      paymentTerms: invoiceData.paymentTerms ?? null,
      currency: invoiceData.currency ?? 'USD',
      items: mergedItems,
      goodsTotal: invoiceData.goodsTotal ?? null,
      additionalCharges: invoiceData.additionalCharges ?? [],
      totalAmount: invoiceData.totalAmount ?? null,
      totalCartons: plData.totalCartons ?? null,
      totalNetWeightKg: plData.totalNetWeightKg ?? null,
      totalGrossWeightKg: plData.totalGrossWeightKg ?? null,
      totalCft: plData.totalCft ?? null,
      dimensions: plData.dimensions ?? null,
      additionalInfo: invoiceData.additionalInfo ?? null,
    }

    return NextResponse.json({ ok: true, data: result })
  } catch (err) {
    console.error('[parse-shipment-excel]', err)
    return NextResponse.json({ error: `解析失敗：${(err as Error).message}` }, { status: 500 })
  }
}
