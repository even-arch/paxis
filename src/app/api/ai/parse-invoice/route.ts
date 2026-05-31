import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'

export interface ParsedInvoice {
  // 文件類型偵測
  // PO = Purchase Order（採購單正本，我方發給供應商）
  // PI = Proforma Invoice（形式發票，供應商發給我方）
  // QUOTE = 報價單
  documentType?: 'PO' | 'PI' | 'QUOTE' | null

  supplierName?: string | null   // 解析完成後已確定的供應商名稱
  supplierEmail?: string | null
  invoiceNo?: string | null
  invoiceDate?: string | null    // YYYY-MM-DD
  currency?: string | null       // USD / TWD / EUR …
  items: {
    name: string                 // AI 猜測的簡短產品名稱（例如：自行車鏈條、腳踏車鏈條）
    specification: string        // 完整原始描述文字（規格說明，原汁原味）
    sku: string | null           // 型號/料號（必填，找不到填 null）
    qty: number
    unitPrice: number
    unit: string                 // 單位（必填，找不到預設 PCS）
    countryOfOrigin?: string | null  // 原產地 ISO 代碼或國家名（若文件中有提及）
  }[]
  notes?: string | null
}

const SYSTEM_PROMPT = `你是一個專業的貿易文件解析助理。
用戶提供採購單（PO）、形式發票（PI/Proforma Invoice）或報價單的內容（文字或圖片）。

## 文件類型判斷規則
- 如果文件抬頭/主位是「我方公司」（通常是發行方 Issued by / From），且文件是發給某個供應商的，則這是 PO（採購單正本）。供應商 = 收件方（To / Attention）。
- 如果文件抬頭/主位是某個供應商（他們是發行方），而我們的公司名稱是在收件方、Bill to、Attention 等次位，則這是 PI（形式發票副本）。供應商 = 發行方（From / Issued by）。
- 如果是報價單（Quotation），documentType = "QUOTE"，供應商是發行方。
- 如果無法判斷，填 null。

## 品項解析規則
- "name"：根據完整描述，用 2-6 個字猜出這個商品的**簡短通用名稱**。語言必須與文件描述的語言一致——文件用中文描述就用中文命名（如「自行車鏈條」），文件用英文描述就用英文命名（如「Bicycle Chain」）。不要把型號、規格、顏色塞進去，不要混用語言。
- "specification"：完整原始描述文字，**原汁原味保留所有細節**，包括型號、顏色、尺寸、材質、包裝方式、認證等。語言與原始文件相同，不做翻譯。
- "sku"：型號/料號（從原始文件抓取，找不到填 null）。
- "unit"：單位（PCS / SET / CTN / KGS 等，找不到預設 "PCS"）。
- "countryOfOrigin"：原產地（若文件中有提及，例如 TAIWAN、CHINA、TW、CN 等，找不到填 null）。

請回傳以下 JSON 格式，不要有任何其他文字：

{
  "documentType": "PO" 或 "PI" 或 "QUOTE" 或 null,
  "supplierName": "已確認的供應商名稱（根據文件類型判斷後的結果）",
  "supplierEmail": "供應商 Email（若有）",
  "invoiceNo": "單據編號",
  "invoiceDate": "日期 YYYY-MM-DD 格式",
  "currency": "幣別代碼，例如 USD",
  "items": [
    {
      "name": "簡短商品名稱（2-6 字）",
      "specification": "完整原始描述（保留所有細節）",
      "sku": "型號或料號（找不到填 null）",
      "qty": 數量（數字）,
      "unitPrice": 單價（數字）,
      "unit": "單位（找不到填 PCS）",
      "countryOfOrigin": "原產地（找不到填 null）"
    }
  ],
  "notes": "備註（若有）"
}

若某欄位無法從文件中找到，填 null。items 至少要有一筆。`

// ── Unified LLM caller (mirrors Patisco ai.service.ts) ──────────────────────

async function callLLM(
  provider: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: unknown }[],
  maxTokens = 4096,
): Promise<string> {
  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.1 }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(err.error?.message ?? `OpenAI error ${res.status}`)
    }
    const data = await res.json() as { choices: { message: { content: string } }[] }
    return data.choices?.[0]?.message?.content ?? ''
  }

  if (provider === 'anthropic') {
    // Anthropic: system is a top-level field, not in messages array
    const system = (messages.find(m => m.role === 'system')?.content as string | undefined)
    const userMessages = messages.filter(m => m.role !== 'system')
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages: userMessages,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(err.error?.message ?? `Anthropic error ${res.status}`)
    }
    const data = await res.json() as { content: { text: string }[] }
    return data.content?.[0]?.text ?? ''
  }

  throw new Error(`不支援的 AI 服務商：${provider}`)
}

// ── File text extraction (mirrors Patisco ai.service.ts) ────────────────────

async function extractFileText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'csv' || mimeType === 'text/csv' || mimeType === 'text/plain') {
    return buffer.toString('utf-8')
  }

  if (ext === 'xlsx' || ext === 'xls' || mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx') as {
      read: (b: Buffer, o: { type: string }) => { SheetNames: string[]; Sheets: Record<string, unknown> }
      utils: { sheet_to_json: (ws: unknown, o: { header: number; defval: string }) => string[][] }
    }
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const lines: string[] = []
    for (const sheetName of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' })
      lines.push(`=== Sheet: ${sheetName} ===`)
      for (const row of rows) lines.push(row.map((c: unknown) => String(c ?? '')).join('\t'))
    }
    return lines.join('\n')
  }

  if (ext === 'pdf' || mimeType === 'application/pdf') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
      const data = await pdfParse(buffer)
      return data.text
    } catch {
      // Fallback: raw text extraction for simple PDFs
      const raw = buffer.toString('latin1')
      const texts = raw.match(/\(([^)]{1,200})\)/g) ?? []
      return texts.map(t => t.slice(1, -1)).join(' ')
    }
  }

  throw new Error(`不支援的檔案格式：${ext || mimeType}`)
}

// ── Robust JSON parsing (mirrors Patisco ai.service.ts) ─────────────────────

function parseInvoiceJson(raw: string): ParsedInvoice {
  let cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/g, '').trim()
  const objStart = cleaned.indexOf('{')
  const objEnd = cleaned.lastIndexOf('}')
  if (objStart !== -1 && objEnd !== -1) cleaned = cleaned.slice(objStart, objEnd + 1)
  const parsed = JSON.parse(cleaned) as ParsedInvoice
  if (!Array.isArray(parsed.items)) parsed.items = []
  return parsed
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.sYS_User.findUnique({
      where: { id: Number(session.user.id) },
      select: { aiProvider: true, encryptedAiKey: true, aiParseModel: true },
    })

    if (!user?.aiProvider || !user?.encryptedAiKey) {
      return NextResponse.json(
        { error: '請先在「設定 → AI 功能」登記您的 API Key' },
        { status: 400 }
      )
    }

    const apiKey = decrypt(user.encryptedAiKey)
    const provider = user.aiProvider
    const model = user.aiParseModel
      || (provider === 'anthropic' ? 'claude-opus-4-8' : 'gpt-4o')

    const contentType = req.headers.get('content-type') ?? ''
    let inputMessages: { role: string; content: unknown }[]

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      if (!file) return NextResponse.json({ error: '未收到檔案' }, { status: 400 })

      const buffer = Buffer.from(await file.arrayBuffer())
      const mimeType = file.type

      if (mimeType.startsWith('image/')) {
        const b64 = buffer.toString('base64')
        if (provider === 'anthropic') {
          inputMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: [
              { type: 'image', source: { type: 'base64', media_type: mimeType, data: b64 } },
              { type: 'text', text: '請解析這張文件，回傳 JSON。' },
            ]},
          ]
        } else {
          inputMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } },
              { type: 'text', text: '請解析這張文件，回傳 JSON。' },
            ]},
          ]
        }
      } else {
        const text = await extractFileText(buffer, mimeType, file.name)
        const truncated = text.length > 60000 ? text.slice(0, 60000) + '\n...[已截斷]' : text
        inputMessages = [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: truncated },
        ]
      }
    } else {
      const body = await req.json() as { text?: string }
      if (!body.text) return NextResponse.json({ error: '未收到內容' }, { status: 400 })
      inputMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: body.text },
      ]
    }

    const raw = await callLLM(provider, apiKey, model, inputMessages)
    const data = parseInvoiceJson(raw)
    return NextResponse.json({ ok: true, data })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/ai/parse-invoice]', msg)
    return NextResponse.json({ error: `解析失敗：${msg}` }, { status: 500 })
  }
}
