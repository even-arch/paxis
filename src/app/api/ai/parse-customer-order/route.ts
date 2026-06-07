import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { callLLM, buildMessagesForFile, parseJsonResponse } from '@/lib/ai-llm'

export interface ParsedCustomerOrder {
  documentType?: 'PO' | 'ORDER' | null
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  customerAddress?: string | null
  customerCity?: string | null
  customerCountry?: string | null
  orderNo?: string | null
  orderDate?: string | null        // YYYY-MM-DD
  requestedShipDate?: string | null // YYYY-MM-DD，客戶希望出貨日
  currency?: string | null
  paymentTerms?: string | null
  items: {
    name: string
    specification: string
    sku: string | null
    qty: number
    unitPrice: number
    unit: string
  }[]
  notes?: string | null
}

const SYSTEM_PROMPT = `你是一個專業的貿易文件解析助理。
用戶提供的是客戶（買方）寄來的訂單文件（PO / Purchase Order）。

## 文件方向
- 這份文件是「買方」發給「我方賣家」的採購訂單。
- 「客戶」= 買方 = 文件的發行方（From / Issued by / Buyer）。
- 「我方」= 賣方 = 文件的收件方（To / Seller / Vendor）。

## 客戶資訊
從文件中找出買方的以下資訊（找不到填 null）：
- customerName: 客戶公司全名
- customerEmail: 客戶 Email
- customerPhone: 客戶電話
- customerAddress: 客戶街道地址
- customerCity: 客戶城市
- customerCountry: 客戶國家（英文）

## 出貨日期
- requestedShipDate: 客戶希望的出貨日或交期（Required Shipment Date / Ship By / Delivery Date）
- 格式 YYYY-MM-DD，找不到填 null

## 商品名稱語言規則（極重要，必須嚴格遵守）
"name" 欄位的語言必須與 "specification" 欄位的主要語言完全一致：
- specification 主要是英文 → name 用英文（如 "Bicycle Chain"、"LED Light Bulb"）
- specification 主要是中文 → name 用中文（如「自行車鏈條」、「LED 燈泡」）
- 絕對不可以英文 specification 配中文 name
- name 只用 2-6 個字，推斷商品的通用類別名稱，不包含型號、顏色、規格

## 品項解析規則
- "name"：2-6 個字的簡短通用類別名稱，語言與 specification 一致
- "specification"：原汁原味保留完整原始描述
- "sku"：型號/料號（直接從文件抓取，找不到填 null）
- "unit"：PCS / SET / CTN / KGS 等（找不到預設 "PCS"）

請回傳以下 JSON 格式，不要有任何其他文字：

{
  "documentType": "PO" 或 "ORDER" 或 null,
  "customerName": "客戶公司全名或 null",
  "customerEmail": "Email 或 null",
  "customerPhone": "電話或 null",
  "customerAddress": "街道地址或 null",
  "customerCity": "城市或 null",
  "customerCountry": "國家或 null",
  "orderNo": "訂單編號或 null",
  "orderDate": "YYYY-MM-DD 或 null",
  "requestedShipDate": "YYYY-MM-DD 或 null",
  "currency": "USD / EUR 等或 null",
  "paymentTerms": "付款條件或 null",
  "items": [
    {
      "name": "2-6字通用名稱",
      "specification": "完整原始描述",
      "sku": "型號或料號或 null",
      "qty": 數量,
      "unitPrice": 單價,
      "unit": "單位"
    }
  ],
  "notes": "備註或 null"
}

若某欄位無法從文件中找到，填 null。items 至少要有一筆。`

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
    const model = user.aiParseModel || (provider === 'anthropic' ? 'claude-opus-4-8' : 'gpt-4o')

    const contentType = req.headers.get('content-type') ?? ''
    let inputMessages: { role: string; content: unknown }[]

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      if (!file) return NextResponse.json({ error: '未收到檔案' }, { status: 400 })

      const buffer = Buffer.from(await file.arrayBuffer())
      const mimeType = file.type

      inputMessages = await buildMessagesForFile(
        buffer, mimeType, file.name,
        SYSTEM_PROMPT, '請解析這份客戶訂單，回傳 JSON。', provider,
      )
    } else {
      const body = await req.json() as { text?: string }
      if (!body.text) return NextResponse.json({ error: '未收到內容' }, { status: 400 })
      inputMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: body.text },
      ]
    }

    const raw = await callLLM(provider, apiKey, model, inputMessages)
    const data = parseJsonResponse<ParsedCustomerOrder>(raw)
    if (!Array.isArray(data.items)) data.items = []
    return NextResponse.json({ ok: true, data })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/ai/parse-customer-order]', msg)
    return NextResponse.json({ error: `解析失敗：${msg}` }, { status: 500 })
  }
}
