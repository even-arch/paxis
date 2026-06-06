import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'

export interface ParsedInvoice {
  documentType?: 'PO' | 'PI' | 'QUOTE' | null
  supplierName?: string | null
  supplierEmail?: string | null
  supplierPhone?: string | null
  supplierAddress?: string | null
  supplierCity?: string | null
  supplierCountry?: string | null
  invoiceNo?: string | null
  invoiceDate?: string | null    // YYYY-MM-DD
  currency?: string | null       // USD / TWD / EUR …
  items: {
    name: string
    specification: string
    sku: string | null
    qty: number
    unitPrice: number
    unit: string
    countryOfOrigin?: string | null
  }[]
  notes?: string | null
}

const SYSTEM_PROMPT = `你是一個專業的貿易文件解析助理。
用戶提供採購單（PO）、形式發票（PI/Proforma Invoice）或報價單的內容（文字或圖片）。

## 文件類型判斷規則
- 文件是「我方公司」發給供應商的 → PO。供應商 = 收件方（To / Attention）。
- 文件是供應商發給我方的 → PI。供應商 = 發行方（From / Issued by）。
- 報價單 → QUOTE，供應商是發行方。
- 無法判斷 → null。

## 供應商資訊
根據文件類型確定誰是「供應商」後，盡量找出以下資訊（找不到填 null）：
- supplierName: 供應商公司全名
- supplierEmail: 供應商 Email
- supplierPhone: 供應商電話/傳真
- supplierAddress: 供應商街道地址
- supplierCity: 供應商城市
- supplierCountry: 供應商國家（英文）

## 商品名稱規則（硬性規定，違反即為錯誤輸出）

"name" 的產生方式：**直接從你輸出的 specification 取第一個有意義的名詞或詞組，翻譯絕對禁止。**

- specification 是英文 → name 必須是英文單字
- specification 是中文 → name 必須是中文詞組
- 不可以把英文 spec 翻譯成中文 name，也不可以把中文 spec 翻譯成英文 name

✅ 正確：
- specification = "CHAIN S52RB+QR (VG-51RB), 116L, SILVER" → name = "Chain"
- specification = "BICYCLE PEDAL AL, 9/16" → name = "Pedal"
- specification = "自行車車架 鋁合金 700C" → name = "自行車車架"
- specification = "LED 燈泡 E27 10W 暖白光" → name = "LED 燈泡"

❌ 錯誤（翻譯了）：
- specification = "CHAIN S52RB+QR, 116L" → name = "鏈條"  ✗ 禁止翻譯
- specification = "PEDAL AL 9/16" → name = "踏板"  ✗ 禁止翻譯
- specification = "螺絲 M6x20" → name = "Screw"  ✗ 禁止翻譯

name 長度 1-4 個英文單字 或 2-5 個中文字，只取類別名稱，不含型號與規格數字。

## 品項解析規則
- "name"：直接從 specification 取第一個名詞，不翻譯，語言與 specification 一致
- "specification"：**原汁原味**保留完整原始描述，包含型號、顏色、尺寸、材質、包裝、認證等
- "sku"：型號/料號（直接從文件抓取，找不到填 null）
- "unit"：PCS / SET / CTN / KGS 等（找不到預設 "PCS"）
- "countryOfOrigin"：原產地（TAIWAN、CHINA、TW、CN 等，找不到填 null）

請回傳以下 JSON 格式，不要有任何其他文字：

{
  "documentType": "PO" 或 "PI" 或 "QUOTE" 或 null,
  "supplierName": "供應商全名",
  "supplierEmail": "供應商 Email 或 null",
  "supplierPhone": "供應商電話或 null",
  "supplierAddress": "供應商街道地址或 null",
  "supplierCity": "供應商城市或 null",
  "supplierCountry": "供應商國家或 null",
  "invoiceNo": "單據編號或 null",
  "invoiceDate": "YYYY-MM-DD 或 null",
  "currency": "USD / TWD / EUR 等或 null",
  "items": [
    {
      "name": "2-6字通用名稱（語言與specification一致）",
      "specification": "完整原始描述",
      "sku": "型號或料號或 null",
      "qty": 數量,
      "unitPrice": 單價,
      "unit": "單位",
      "countryOfOrigin": "原產地或 null"
    }
  ],
  "notes": "備註或 null"
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
