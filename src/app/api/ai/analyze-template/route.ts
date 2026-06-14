/**
 * POST /api/ai/analyze-template
 * 上傳一張文件圖片，AI 分析版面，回傳 HTML/CSS 模板草稿。
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { decrypt } from '@/lib/crypto'
import { buildMessagesForFile } from '@/lib/ai-llm'

const PAXIS_FIELDS = `
## PAXIS 可用欄位（用 {{變數名}} 代入）

### 我方公司（SYS_Company）
{{company.logo}}         我方公司 Logo（已是 <img> 標籤，直接放入即可，不要加 src）
{{company.nameEn}}       我方公司英文名稱
{{company.nameZh}}       我方公司中文名稱
{{company.addressEn}}    我方地址（英文）
{{company.city}}         我方城市
{{company.countryCode}}  我方國家代碼
{{company.phone}}        我方電話
{{company.fax}}          我方傳真
{{company.email}}        我方 Email
{{company.taxId}}        我方統一編號
{{company.bankName}}     銀行名稱
{{company.bankAccount}}  銀行帳號
{{company.bankSwift}}    SWIFT Code

### 買方（CUS_Customer）
{{customer.name}}         客戶公司名稱
{{customer.address}}      客戶地址
{{customer.city}}         客戶城市
{{customer.countryCode}}  客戶國家
{{customer.contactPerson}} 客戶聯絡人
{{customer.email}}        客戶 Email

### PI 資訊（SLS_PI）
{{pi.piNo}}               PI 號碼
{{pi.piDate}}             PI 日期
{{pi.estimatedShipDate}}  預計出貨日
{{pi.tradeTerms}}         交易條件（FOB / FOR / CIF…）

### 訂單資訊（SLS_Order）
{{order.orderNo}}         我方訂單號
{{order.customerPoNo}}    客戶 PO 號
{{order.currencyCode}}    幣別
{{order.paymentTerms}}    付款條件

### 品項（逐行重複區塊，用 {{#items}}…{{/items}} 包住）
{{item.productName}}      品名
{{item.sku}}              SKU / 料號
{{item.modelNo}}          型號
{{item.specification}}    規格描述
{{item.unit}}             單位
{{item.quantity}}         數量
{{item.unitPrice}}        單價
{{item.amount}}           小計
{{item.currencyCode}}     幣別

### 合計列
{{totals.amount}}         總金額
{{totals.currencyCode}}   幣別
{{totals.cartons}}        總箱數
{{totals.grossWeightKg}}  總毛重（kg）
{{totals.cbm}}            總材積（CBM）

### 採購單（PO_Order）專用
{{supplier.name}}         供應商名稱
{{supplier.address}}      供應商地址
{{supplier.contactPerson}} 供應商聯絡人
{{po.poNo}}               PO 號碼
{{po.orderDate}}          PO 日期
{{po.expectedDate}}       預計到貨日
{{po.tradeTerms}}         交易條件
{{po.currencyCode}}       幣別

### 裝箱單（PL）/ 商業發票（CI）專用
{{shipment.shipmentNo}}       出貨單號
{{shipment.packingListNo}}    裝箱單號（PL 使用）
{{shipment.commercialInvNo}}  商業發票號（CI 使用）
{{shipment.actualShipDate}}   實際出貨日
{{shipment.portOfLoading}}    裝載港
{{shipment.portOfDischarge}}  卸貨港
{{shipment.trackingNo}}       提單號（B/L No.）
{{shipment.currencyCode}}     幣別（CI 使用）
{{shipment.piNos}}            關聯 PI 號碼清單
{{totals.netWeightKg}}        總淨重（kg）

### 裝箱單品項（{{#items}}...{{/items}} 內使用）
{{item.cartons}}          箱數
{{item.cartonRange}}      箱號範圍（如 1–10）
{{item.grossWeightKg}}    毛重（kg）
{{item.netWeightKg}}      淨重（kg）
{{item.cbm}}              材積（CBM）

### 自由欄位（使用者列印前手動填入，不存資料庫）
{{free.portOfLoading}}    裝載港
{{free.portOfDischarge}}  卸貨港
{{free.countryOfOrigin}}  原產地
{{free.shippingMarks}}    麥頭
{{free.remarks}}          備註
{{free.paymentTerms}}     付款條件（CI 使用）
{{free.deliveryAddress}}  送貨地址（PO 使用）
{{free.specialInstructions}} 特殊指示（PO 使用）
`

const SYSTEM_PROMPT = `你是專業的商業文件 HTML 版面設計師。
使用者會給你一張 PI（Proforma Invoice）的圖片樣本，
你需要：
1. 分析版面結構（標題位置、欄位排列、色彩、字型大小等）
2. 生成一份 HTML/CSS 模板，盡量還原這張文件的視覺風格
3. 在對應位置插入 PAXIS 欄位佔位符（格式：{{變數名}}）
4. 若文件中出現 PAXIS 沒有的欄位，用 {{free.XXX}} 標記為自由欄位

${PAXIS_FIELDS}

## 視覺還原規則（非常重要）
盡可能還原原始文件的視覺外觀，包括：
- **底色/背景色**：表頭、小計行、特定欄位若有底色，必須用 background-color 重現（如 #1e3a5f、#f0f0f0、#e8e8e8 等，根據圖片判斷實際色值）
- **框線**：粗細、顏色、單邊或四邊，都要還原
- **間距**：欄與欄之間、行高、padding，參考原始比例
- **對齊方式**：數字靠右、標題置中、說明靠左，依原始文件
- **字體粗細**：標題 bold、內文 normal，按原始文件
- **分隔線**：若原始文件用橫線區隔區塊，用 border-bottom 或 <hr> 還原
- **色塊區域**：若某個區塊有明顯的色塊背景（如深藍色抬頭列），必須還原
寧可多猜顏色、多加細節，也不要輸出一個完全沒有視覺特徵的白底黑字表格。

## Logo 規則
- 若文件中有 Logo 位置，放 {{company.logo}}，系統會自動替換成實際圖片
- 不要用 <img src="..."> 或任何硬編碼圖片，只用 {{company.logo}}

## 列印規則（必須遵守）
- 使用內聯 CSS（style 屬性），不要用外部 CSS 或 class
- 整體字體：Arial, sans-serif；基礎字號 9pt
- 品項表格的 <thead> 必須在每頁重複：<thead style="display:table-header-group">
- 每一行 <tr> 加 style="page-break-inside:avoid"
- 簽名欄加 style="page-break-inside:avoid"
- 所有金額靠右對齊
- 頁首：公司名稱 + 文件標題，每頁都要有
- 頁碼：右上角或右下角，格式 Page X of Y（用 CSS counter 實現，不要用 JS）

## 輸出格式（只回傳 JSON，不要加任何說明或 markdown）
{
  "templateName": "從圖片判斷的模板名稱（如：標準 PI 格式 / 客戶 A 專用格式）",
  "htmlBody": "完整 HTML 字串（不含 <!DOCTYPE> 和 <html> 標籤，從 <div> 開始）",
  "freeFields": [
    { "key": "portOfLoading", "label": "Port of Loading", "defaultValue": "" }
  ],
  "analysisNote": "簡短說明版面特點與無法對應的欄位（繁體中文）"
}`

// 結構化輸出的 schema（Anthropic tool_use / OpenAI json_schema 共用定義）
const OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false as const,
  properties: {
    templateName: { type: 'string' as const, description: '從圖片判斷的模板名稱' },
    htmlBody: { type: 'string' as const, description: '完整 HTML 字串（不含 <!DOCTYPE> 和 <html>，從 <div> 開始）' },
    freeFields: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        additionalProperties: false as const,
        properties: {
          key:          { type: 'string' as const },
          label:        { type: 'string' as const },
          defaultValue: { type: 'string' as const },
        },
        required: ['key', 'label', 'defaultValue'] as const,
      },
    },
    analysisNote: { type: 'string' as const, description: '簡短說明版面特點（繁體中文）' },
  },
  required: ['templateName', 'htmlBody', 'freeFields', 'analysisNote'] as const,
}

type TemplateResult = {
  templateName: string
  htmlBody: string
  freeFields: { key: string; label: string; defaultValue: string }[]
  analysisNote: string
}

async function callAnthropicStructured(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessages: { role: string; content: unknown }[],
): Promise<TemplateResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: userMessages,
      tools: [{
        name: 'generate_template',
        description: '根據文件圖片生成 HTML 列印模板',
        input_schema: OUTPUT_SCHEMA,
      }],
      tool_choice: { type: 'tool', name: 'generate_template' },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? `Anthropic error ${res.status}`)
  }
  const data = await res.json() as { content: { type: string; input?: TemplateResult }[] }
  const toolBlock = data.content.find(c => c.type === 'tool_use')
  if (!toolBlock?.input) throw new Error('No tool_use block in response')
  return toolBlock.input
}

async function callOpenAIStructured(
  apiKey: string,
  model: string,
  messages: { role: string; content: unknown }[],
): Promise<TemplateResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0.1,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'template_result',
          strict: true,
          schema: OUTPUT_SCHEMA,
        },
      },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? `OpenAI error ${res.status}`)
  }
  const data = await res.json() as { choices: { message: { content: string } }[] }
  const raw = data.choices?.[0]?.message?.content ?? ''
  return JSON.parse(raw) as TemplateResult
}

export async function POST(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.sYS_User.findUnique({
    where: { id: Number(session.user.id) },
    select: { aiProvider: true, encryptedAiKey: true, aiParseModel: true },
  })

  if (!user?.aiProvider || !user?.encryptedAiKey) {
    return NextResponse.json({ error: '請先在「設定 → AI 功能」登記您的 API Key' }, { status: 400 })
  }

  const apiKey = decrypt(user.encryptedAiKey)
  const model = user.aiParseModel ?? (user.aiProvider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o')

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: '請上傳檔案' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/png')

  const messages = await buildMessagesForFile(
    buffer,
    mimeType,
    file.name,
    SYSTEM_PROMPT,
    '請分析這份文件的版面，生成 HTML 模板。',
    user.aiProvider,
  )

  try {
    let result: TemplateResult
    if (user.aiProvider === 'anthropic') {
      const system = messages.find(m => m.role === 'system')?.content as string | undefined
      const userMessages = messages.filter(m => m.role !== 'system')
      result = await callAnthropicStructured(apiKey, model, system ?? '', userMessages)
    } else {
      result = await callOpenAIStructured(apiKey, model, messages as { role: string; content: unknown }[])
    }
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `AI 分析失敗：${message}` }, { status: 422 })
  }
}
