import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { decrypt } from '@/lib/crypto'
import { callLLM, buildMessagesForFile, parseJsonResponse } from '@/lib/ai-llm'

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
    htsCode?: string | null
  }[]
  notes?: string | null
}

const SYSTEM_PROMPT = `你是一個專業的貿易文件解析助理。
用戶提供供應商訂單（PO）、形式發票（PI/Proforma Invoice）或報價單的內容（文字或圖片）。

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

## 商品名稱規則（核心任務）

"name" 的目的：**讓海關人員打開箱子後，一眼就能確認這是什麼產品。** 這是 name 的唯一目的。

你必須**讀懂 specification 的語義**，理解這個商品是什麼，然後用簡短的產品類別名稱表達。這不是字串擷取，而是語義理解。

### 命名規則

1. **讀懂規格，說出產品是什麼**：看完整個 specification，判斷這是哪一類產品
2. **語言與 specification 一致**：英文規格 → 英文名稱，中文規格 → 中文名稱，禁止翻譯
3. **名稱長度**：1–4 個英文單字，或 2–6 個中文字
4. **禁止填入型號**：sku/model number/料號已有獨立的 "sku" 欄位，name 絕對不能是型號

✅ 正確示範（語義理解）：
- specification = "CHAIN S52RB+QR (VG-51RB), 116L, SILVER" → name = "Bicycle Chain"
- specification = "BICYCLE PEDAL AL, 9/16" → name = "Bicycle Pedal"
- specification = "BRAKE LEVER BL-M315, LEFT" → name = "Brake Lever"
- specification = "CASSETTE SPROCKET CS-HG200, 8-SPEED" → name = "Cassette Sprocket"
- specification = "自行車車架 鋁合金 700C 黑色" → name = "自行車車架"
- specification = "LED 燈泡 E27 10W 暖白光" → name = "LED 燈泡"

❌ 錯誤示範：
- specification = "CHAIN S52RB+QR, 116L" → name = "S52RB"  ✗ 這是型號不是產品名
- specification = "BRAKE LEVER BL-M315" → name = "BL-M315"  ✗ 這是型號不是產品名
- specification = "CHAIN S52RB+QR" → name = "鏈條"  ✗ 禁止翻譯成中文
- specification = "螺絲 M6x20" → name = "Screw"  ✗ 禁止翻譯成英文

## 品項解析規則
- "name"：**讀懂 specification 語義後**，用 1–4 個英文單字（或 2–6 中文字）說明這是什麼產品。語言與 specification 一致，禁止翻譯，禁止填入型號。
- "specification"：**原汁原味**保留完整原始描述，包含型號、顏色、尺寸、材質、包裝、認證等
- "sku"：型號/料號（直接從文件抓取，找不到填 null）
- "unit"：PCS / SET / CTN / KGS 等（找不到預設 "PCS"）
- "countryOfOrigin"：原產地（TAIWAN、CHINA、TW、CN 等，找不到填 null）
- "htsCode"：HS Code / HTS Code / 稅則號列（6-10碼，如 8714.99，找不到填 null）

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
      "countryOfOrigin": "原產地或 null",
      "htsCode": "HS Code 或 null"
    }
  ],
  "notes": "備註或 null"
}

若某欄位無法從文件中找到，填 null。items 至少要有一筆。`


// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const prisma = await getRequestPrisma()
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
      inputMessages = await buildMessagesForFile(
        buffer, file.type, file.name,
        SYSTEM_PROMPT, '請解析這張文件，回傳 JSON。', provider,
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
    const data = parseJsonResponse<ParsedInvoice>(raw)
    if (!Array.isArray(data.items)) data.items = []
    return NextResponse.json({ ok: true, data })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/ai/parse-invoice]', msg)
    return NextResponse.json({ error: `解析失敗：${msg}` }, { status: 500 })
  }
}
