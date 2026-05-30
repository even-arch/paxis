import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'

export interface ParsedInvoice {
  supplierName?: string | null
  supplierEmail?: string | null
  invoiceNo?: string | null
  invoiceDate?: string | null   // YYYY-MM-DD
  currency?: string | null      // USD / TWD / EUR …
  items: {
    description: string
    sku?: string | null
    qty: number
    unitPrice: number
    unit?: string | null        // PCS / SET / CTN …
  }[]
  notes?: string | null
}

const SYSTEM_PROMPT = `你是一個專業的貿易文件解析助理。
用戶提供採購單、發票或 Proforma Invoice 的內容（文字或圖片）。
請解析出以下資訊，以 JSON 格式回傳，不要有任何其他文字：

{
  "supplierName": "供應商名稱",
  "supplierEmail": "供應商 Email（若有）",
  "invoiceNo": "發票/採購單號",
  "invoiceDate": "日期 YYYY-MM-DD 格式",
  "currency": "幣別代碼，例如 USD",
  "items": [
    {
      "description": "商品名稱",
      "sku": "型號或料號（若有）",
      "qty": 數量（數字）,
      "unitPrice": 單價（數字）,
      "unit": "單位，例如 PCS"
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
  const provider = user.aiProvider  // 'anthropic' | 'openai'
  // 使用者選擇的模型，或預設值
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
      // Vision: send as base64 image
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
      // Text-based: extract text first
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

  try {
    const raw = await callLLM(provider, apiKey, model, inputMessages)
    const data = parseInvoiceJson(raw)
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `AI 解析失敗：${msg}` }, { status: 500 })
  }
}
