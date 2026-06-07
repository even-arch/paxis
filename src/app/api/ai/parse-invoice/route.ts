import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
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
