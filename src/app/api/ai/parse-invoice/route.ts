import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'

// 回傳格式：解析出的採購單資料
export interface ParsedInvoice {
  supplierName?: string
  supplierEmail?: string
  invoiceNo?: string
  invoiceDate?: string
  currency?: string        // USD / TWD / EUR …
  items: {
    description: string
    sku?: string
    qty: number
    unitPrice: number
    unit?: string          // PCS / SET / CTN …
  }[]
  notes?: string
}

const SYSTEM_PROMPT = `你是一個專業的貿易文件解析助理。
用戶會提供一張採購單、發票或 Proforma Invoice 的內容（文字或圖片）。
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

async function callClaude(apiKey: string, content: string, mimeType?: string): Promise<ParsedInvoice> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messageContent: any[] = mimeType
    ? [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: content } },
        { type: 'text', text: '請解析這張文件，回傳 JSON。' },
      ]
    : [{ type: 'text', text: content }]

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: messageContent }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = data.content?.[0]?.text ?? ''
  return JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text)
}

async function callOpenAI(apiKey: string, content: string, mimeType?: string): Promise<ParsedInvoice> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messageContent: any[] = mimeType
    ? [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${content}` } },
        { type: 'text', text: '請解析這張文件，回傳 JSON。' },
      ]
    : [{ type: 'text', text: content }]

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 2048,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: messageContent },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content ?? ''
  return JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 取得用戶的 AI 設定
  const user = await prisma.sYS_User.findUnique({
    where: { id: Number(session.user.id) },
    select: { aiProvider: true, encryptedAiKey: true },
  })

  if (!user?.aiProvider || !user?.encryptedAiKey) {
    return NextResponse.json(
      { error: '請先在「設定 → AI 功能」登記您的 API Key' },
      { status: 400 }
    )
  }

  const apiKey = decrypt(user.encryptedAiKey)

  // 接收 multipart/form-data（檔案）或 JSON（純文字）
  const contentType = req.headers.get('content-type') ?? ''
  let textContent = ''
  let base64Content = ''
  let mimeType: string | undefined

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '未收到檔案' }, { status: 400 })

    mimeType = file.type
    const buffer = Buffer.from(await file.arrayBuffer())

    if (mimeType === 'application/pdf') {
      // PDF：轉 base64，Claude/GPT-4o Vision 支援
      base64Content = buffer.toString('base64')
    } else if (mimeType.startsWith('image/')) {
      base64Content = buffer.toString('base64')
    } else {
      // 其他（xlsx, csv, txt）：嘗試直接讀文字
      textContent = buffer.toString('utf-8')
      mimeType = undefined
    }
  } else {
    const body = await req.json()
    textContent = body.text ?? ''
  }

  const input = base64Content || textContent
  if (!input) return NextResponse.json({ error: '無法讀取檔案內容' }, { status: 400 })

  try {
    let parsed: ParsedInvoice
    if (user.aiProvider === 'claude') {
      parsed = await callClaude(apiKey, input, mimeType)
    } else {
      parsed = await callOpenAI(apiKey, input, mimeType)
    }
    return NextResponse.json({ ok: true, data: parsed })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `AI 解析失敗：${msg}` }, { status: 500 })
  }
}
