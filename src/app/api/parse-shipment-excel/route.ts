/**
 * POST /api/parse-shipment-excel
 * 接收含 Invoice + PackingList 兩個 Tab 的 Excel（.xls / .xlsx），
 * 純程式解析（不依賴 AI），回傳結構化出貨資料供前端預覽確認。
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { callLLM, buildMessagesForFile, parseJsonResponse } from '@/lib/ai-llm'

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

export interface ParsedAddress {
  name: string
  addressLine: string
  city: string
  postalCode: string
  countryCode: string   // 2-letter ISO，能猜就猜
  raw: string           // 原始多行文字，供 fallback
}

export interface ParsedShipmentExcel {
  invoiceNo: string | null
  packingListNo: string | null
  orderNo: string | null
  shipmentDate: string | null   // YYYY-MM-DD
  soldTo: string | null
  deliverTo: string | null
  soldToAddress: ParsedAddress | null   // 完整收件地址
  deliverToAddress: ParsedAddress | null
  shipperName: string | null            // CI 上的寄件方名稱（可能是供應商）
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
  dimensionsCm: { l: number; w: number; h: number } | null  // 解析後的 L×W×H（公分）
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

/** 從 "L: 60 × W: 40 × H: 30 CM" 或 "L:60 W:40 H:30" 解析出 l/w/h（公分） */
function parseDimensionsCm(s: string | null): { l: number; w: number; h: number } | null {
  if (!s) return null
  const l = s.match(/L[:\s]+([\d.]+)/i)
  const w = s.match(/W[:\s]+([\d.]+)/i)
  const h = s.match(/H[:\s]+([\d.]+)/i)
  if (!l || !w || !h) return null
  const lv = parseFloat(l[1]), wv = parseFloat(w[1]), hv = parseFloat(h[1])
  if (isNaN(lv) || isNaN(wv) || isNaN(hv)) return null
  return { l: lv, w: wv, h: hv }
}

/**
 * 從多行地址文字解析出結構化地址
 * 典型歐洲格式：
 *   Company Name
 *   Street 123
 *   12345 City
 *   GERMANY
 */
function parseAddress(raw: string | null): ParsedAddress | null {
  if (!raw || !raw.trim()) return null
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return null

  const name = lines[0]
  const addressLine = lines[1] ?? ''

  // 試著從後面幾行找國家碼（2字母純英文行）和郵遞區號（含數字的行）
  let countryCode = ''
  let postalCode = ''
  let city = ''

  // 從最後一行往前找
  for (let i = lines.length - 1; i >= 2; i--) {
    const line = lines[i]
    // 純字母 2-3 字 → 可能是國家名
    if (!countryCode && /^[A-Z]{2,3}$/.test(line)) {
      countryCode = line.substring(0, 2)
      continue
    }
    // 含數字 → 郵遞區號 + 城市（格式: "12345 City" 或 "City 12345"）
    if (!postalCode && /\d{4,6}/.test(line)) {
      const m = line.match(/(\d{4,6})/)
      if (m) postalCode = m[1]
      city = line.replace(postalCode, '').replace(/[,\s]+$/, '').replace(/^[,\s]+/, '').trim()
      continue
    }
    // 剩餘行 → 城市候補
    if (!city) city = line
  }

  // fallback：若只有 2 行，第 2 行當地址
  if (lines.length === 2) {
    return { name, addressLine: lines[1], city: '', postalCode: '', countryCode: '', raw }
  }

  return { name, addressLine, city, postalCode, countryCode, raw }
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
      const raw = str(row[1])
      result.soldTo = raw.split('\n')[0]
      result.soldToAddress = parseAddress(raw)
    }

    // DELIVER TO
    if (c0 === 'DELIVER TO' && !result.deliverTo) {
      const raw = str(row[1])
      result.deliverTo = raw.split('\n')[0]
      result.deliverToAddress = parseAddress(raw)
    }

    // Shipment: 裡有寄件方 & 日期 & 原產地 & 目的地
    if (c0 === 'Shipment:' && !result.shipmentDate) {
      const lines = str(row[1]).split('\n').map(l => l.trim()).filter(Boolean)
      // lines: [shipper, date, origin, destination]
      if (lines[0]) result.shipperName = lines[0]
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

// ── AI prompt for PDF/image parsing ─────────────────────────────────────────

const AI_SYSTEM_PROMPT = `你是專業的出口文件解析助理，負責從 Commercial Invoice（CI）或 Packing List（PL）中提取出貨資訊。

請解析文件並回傳以下 JSON（所有找不到的欄位填 null，不要猜測）：
{
  "invoiceNo": "CI 號碼",
  "packingListNo": "PL 號碼",
  "orderNo": "客戶訂單號",
  "shipmentDate": "YYYY-MM-DD",
  "soldTo": "買方公司名稱",
  "deliverTo": "收貨方名稱",
  "shipperName": "寄件方名稱",
  "origin": "出貨地/裝載港",
  "destination": "目的地",
  "paymentTerms": "付款條件",
  "currency": "幣別如EUR/USD",
  "goodsTotal": 貨品小計金額（數字）,
  "additionalCharges": [{"description":"費用名稱","amount":金額,"currency":"幣別"}],
  "totalAmount": 含附加費用的總金額（數字）,
  "items": [
    {
      "itemNo": "SKU/料號",
      "description": "完整描述",
      "qty": 數量,
      "unit": "單位如PCS/SET",
      "unitPrice": 單價（數字）,
      "currency": "幣別",
      "grossWeightKg": 毛重（數字或null）,
      "cft": 材積立方英尺（數字或null）
    }
  ],
  "totalCartons": 總箱數（數字）,
  "totalGrossWeightKg": 總毛重（數字）,
  "totalNetWeightKg": 總淨重（數字）,
  "totalCft": 總材積ft³（數字）,
  "dimensions": "箱子尺寸如L:60 W:40 H:30 CM"
}

只回傳 JSON，不要加任何說明文字。`

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: '請上傳檔案' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const isPdf = ext === 'pdf' || file.type === 'application/pdf'
    const isImage = file.type.startsWith('image/')

    // PDF / 圖片 → AI 解析
    if (isPdf || isImage) {
      const user = await prisma.sYS_User.findUnique({
        where: { id: Number(session.user.id) },
        select: { aiProvider: true, encryptedAiKey: true, aiParseModel: true },
      })
      if (!user?.aiProvider || !user?.encryptedAiKey) {
        return NextResponse.json({ error: '請先在「設定 → AI 功能」登記 API Key' }, { status: 400 })
      }
      const apiKey = decrypt(user.encryptedAiKey)
      const provider = user.aiProvider
      const model = user.aiParseModel || (provider === 'anthropic' ? 'claude-opus-4-8' : 'gpt-4o')

      const buffer = Buffer.from(await file.arrayBuffer())
      const messages = await buildMessagesForFile(
        buffer, file.type, file.name,
        AI_SYSTEM_PROMPT, '請解析這份出貨文件，回傳 JSON。', provider,
      )
      const raw = await callLLM(provider, apiKey, model, messages)
      const ai = parseJsonResponse<Partial<ParsedShipmentExcel> & { items?: unknown[] }>(raw)

      // 把 AI 結果正規化成 ParsedShipmentExcel 形狀
      const result: ParsedShipmentExcel = {
        invoiceNo: (ai.invoiceNo as string | null) ?? null,
        packingListNo: (ai.packingListNo as string | null) ?? null,
        orderNo: (ai.orderNo as string | null) ?? null,
        shipmentDate: (ai.shipmentDate as string | null) ?? null,
        soldTo: (ai.soldTo as string | null) ?? null,
        deliverTo: (ai.deliverTo as string | null) ?? null,
        soldToAddress: null,
        deliverToAddress: null,
        shipperName: (ai.shipperName as string | null) ?? null,
        origin: (ai.origin as string | null) ?? null,
        destination: (ai.destination as string | null) ?? null,
        paymentTerms: (ai.paymentTerms as string | null) ?? null,
        currency: (ai.currency as string) ?? 'USD',
        items: Array.isArray(ai.items) ? (ai.items as Record<string, unknown>[]).map(it => ({
          itemNo: String(it.itemNo ?? ''),
          description: String(it.description ?? ''),
          qty: Number(it.qty ?? 0),
          unit: String(it.unit ?? 'PCS'),
          unitPrice: it.unitPrice != null ? Number(it.unitPrice) : null,
          currency: String(it.currency ?? ai.currency ?? 'USD'),
          amount: it.amount != null ? Number(it.amount) : null,
          netWeightKg: it.netWeightKg != null ? Number(it.netWeightKg) : null,
          grossWeightKg: it.grossWeightKg != null ? Number(it.grossWeightKg) : null,
          cft: it.cft != null ? Number(it.cft) : null,
          cartonNo: null,
        })) : [],
        goodsTotal: (ai.goodsTotal as number | null) ?? null,
        additionalCharges: Array.isArray(ai.additionalCharges)
          ? (ai.additionalCharges as { description: string; amount: number; currency: string }[])
          : [],
        totalAmount: (ai.totalAmount as number | null) ?? null,
        totalCartons: (ai.totalCartons as number | null) ?? null,
        totalNetWeightKg: (ai.totalNetWeightKg as number | null) ?? null,
        totalGrossWeightKg: (ai.totalGrossWeightKg as number | null) ?? null,
        totalCft: (ai.totalCft as number | null) ?? null,
        dimensions: (ai.dimensions as string | null) ?? null,
        dimensionsCm: parseDimensionsCm((ai.dimensions as string | null) ?? null),
        additionalInfo: null,
      }
      return NextResponse.json({ ok: true, data: result })
    }

    // Excel → 程式解析（原有邏輯）
    if (!['xls', 'xlsx'].includes(ext)) {
      return NextResponse.json({ error: '不支援的檔案格式，請上傳 PDF 或 Excel' }, { status: 400 })
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
      soldToAddress: invoiceData.soldToAddress ?? null,
      deliverToAddress: invoiceData.deliverToAddress ?? null,
      shipperName: invoiceData.shipperName ?? null,
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
      dimensionsCm: parseDimensionsCm(plData.dimensions ?? null),
      additionalInfo: invoiceData.additionalInfo ?? null,
    }

    return NextResponse.json({ ok: true, data: result })
  } catch (err) {
    console.error('[parse-shipment-excel]', err)
    return NextResponse.json({ error: `解析失敗：${(err as Error).message}` }, { status: 500 })
  }
}
