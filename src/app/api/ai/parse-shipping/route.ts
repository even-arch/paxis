/**
 * POST /api/ai/parse-shipping
 * 上傳 PDF/Excel/CSV，用 AI 解析出出貨相關資料：
 * - 收件方地址
 * - 裝箱品項（品名、規格、數量、金額、產品號）
 * - 申報金額
 *
 * 回傳 ParsedShipping 物件，由前端決定要套用哪些欄位。
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { callLLM, buildMessagesForFile, parseJsonResponse } from '@/lib/ai-llm'

export interface ParsedShipping {
  // 收件方
  recipientName?: string | null
  recipientAddress?: string | null
  recipientCity?: string | null
  recipientState?: string | null
  recipientPostal?: string | null
  recipientCountry?: string | null
  recipientTaxId?: string | null

  // 報關
  declaredValueUsd?: number | null
  currencyCode?: string | null

  // 品項（對應一箱或整批）
  items: Array<{
    sku?: string
    modelNo?: string
    name?: string
    specification?: string
    quantity: number
    unitPrice?: number
    unit?: string
  }>

  // 備注
  notes?: string | null
}

const SYSTEM_PROMPT = `你是專業的出口裝箱單解析助理，負責從各種格式的貿易文件中提取出貨資訊。

請解析文件內容，提取以下資訊並回傳 JSON：
{
  "recipientName": "收件方公司或姓名",
  "recipientAddress": "街道地址",
  "recipientCity": "城市",
  "recipientState": "州或省（若有）",
  "recipientPostal": "郵遞區號",
  "recipientCountry": "國家代碼（2碼，如US/TW/DE）",
  "recipientTaxId": "統編或稅號（若有）",
  "declaredValueUsd": 申報金額（數字，折算為USD，若非USD請換算，無法確定填null）,
  "currencyCode": "原始幣別（USD/TWD/EUR等）",
  "items": [
    {
      "sku": "產品SKU或料號",
      "modelNo": "型號",
      "name": "品名",
      "specification": "規格說明",
      "quantity": 數量（數字）,
      "unitPrice": 單價（數字）,
      "unit": "單位如PC/SET/PCS"
    }
  ],
  "notes": "其他備注"
}

注意：
- 國家代碼務必轉成 ISO 2碼（台灣=TW，美國=US，德國=DE）
- 找不到的欄位填 null，不要猜測
- items 陣列若無資料填空陣列 []
- 只回傳 JSON，不加其他說明`

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  
  // 取 AI 設定
  const user = await prisma.sYS_User.findFirst({
    where: { loginId: session.user.email ?? '' },
    select: { aiProvider: true, encryptedAiKey: true, aiParseModel: true },
  })

  const aiProvider = user?.aiProvider ?? 'anthropic'
  const apiKey = user?.encryptedAiKey ? decrypt(user.encryptedAiKey) : (
    aiProvider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY
  ) ?? ''
  const model = user?.aiParseModel ?? (aiProvider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini')

  if (!apiKey) {
    return NextResponse.json({ error: '請先在「設定 → AI 功能」設定 AI API Key' }, { status: 400 })
  }

  // 解析 multipart + 呼叫 AI
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: '請上傳檔案' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const messages = await buildMessagesForFile(
      buffer, file.type, file.name,
      SYSTEM_PROMPT, '請解析這份出貨文件，回傳 JSON。', aiProvider,
    )

    const raw = await callLLM(aiProvider, apiKey, model, messages, 2048)
    const parsed = parseJsonResponse<ParsedShipping>(raw)
    parsed.items ??= []

    return NextResponse.json({ ok: true, data: parsed })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `解析失敗：${msg}` }, { status: 500 })
  }
}
