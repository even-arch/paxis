import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { decrypt } from '@/lib/crypto'
import { callLLM, buildMessagesForFile, parseJsonResponse } from '@/lib/ai-llm'

export interface ParsedCustomerOrder {
  /**
   * 文件類型：
   * - "PI"    = 我方發出的形式發票（Proforma Invoice），賣方是我們
   * - "PO"    = 客戶發來的採購訂單（Purchase Order），買方是客戶
   * - "ORDER" = 其他類型訂單
   */
  documentType?: 'PI' | 'PO' | 'ORDER' | null
  /** 若 documentType === 'PI'，這是 PI 號碼 */
  piNo?: string | null
  estimatedShipDate?: string | null  // PI 上的預計出貨日
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
用戶提供的是「客戶端相關文件」，可能是以下兩種之一：

## 文件類型判斷（最優先，必須先判斷）

判斷依據是**文件的主從關係**（誰發出、誰收到），而不只是標題文字。

**類型 A：客戶（買方）發給我方（賣方）的採購訂單 → documentType = "PO"**
- 判斷邏輯：文件是「買方」發出的，我方是「收件人 / 賣方 / Vendor / Supplier / Seller」
- 常見標題：Purchase Order、P.O.、Order Confirmation、Ordering Sheet
- 文件上「From / Issued by / Buyer / Ordered by」= 客戶，「To / Seller / Vendor」= 我方

**類型 B：我方（賣方）發給客戶（買方）的形式發票 → documentType = "PI"**
- 判斷邏輯：文件是「我方賣方」發出的，客戶是「收件人 / 買方 / Buyer / To」
- 常見標題：Proforma Invoice、Pro-forma Invoice、P.I.、Quotation（若含確認訂購意思）
- 文件上「From / Issued by / Seller / Exporter」= 我方，「To / Bill To / Buyer / Consignee」= 客戶

**⚠️ 判斷重點**：
- 「我方」通常是台灣或亞洲的供應商/出口商
- 「客方」通常是歐美或其他地區的進口商/採購商
- 若仍無法確定，優先以**誰是 Issuer（發行者）**判斷：我方發行 = PI，客方發行 = PO

根據判斷結果，documentType 填：
- "PI" → 類型 B（我方形式發票）
- "PO" → 類型 A（客戶採購訂單）
- "ORDER" → 無法確定類型

---

## PI 專屬欄位（documentType==="PI" 時才需填）
- piNo: 文件上的 PI 號碼（Proforma Invoice No. / PI No.）
- estimatedShipDate: PI 上的預計出貨日（Est. Ship Date / Shipment Date）格式 YYYY-MM-DD

## 客戶資訊（買方）
從文件中找出買方的以下資訊（找不到填 null）：
- customerName: 客戶公司全名
- customerEmail: 客戶 Email
- customerPhone: 客戶電話
- customerAddress: 客戶街道地址
- customerCity: 客戶城市
- customerCountry: 客戶國家（英文）

## 訂單/PI 資訊
- orderNo: 若是 PO，填客戶的 PO 號；若是 PI，填 PI 號（和 piNo 相同）
- requestedShipDate: 客戶希望的出貨日（PO 場合）或 PI 上的預計出貨日（找不到填 null）
- 格式 YYYY-MM-DD

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
  "documentType": "PI" 或 "PO" 或 "ORDER" 或 null,
  "piNo": "PI號碼或 null（僅 documentType=PI 時填）",
  "estimatedShipDate": "YYYY-MM-DD 或 null（僅 documentType=PI 時填）",
  "customerName": "客戶公司全名或 null",
  "customerEmail": "Email 或 null",
  "customerPhone": "電話或 null",
  "customerAddress": "街道地址或 null",
  "customerCity": "城市或 null",
  "customerCountry": "國家或 null",
  "orderNo": "訂單編號或 PI 號或 null",
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
