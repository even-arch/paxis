/**
 * POST /api/ai/parse-pi
 * 上傳我方發出的 PI 文件（PDF/Excel），用 AI 解析出 PI 號、出貨日、品項。
 * 解析結果由前端在 /sales/[id]/pi-import 頁預覽確認後，再 POST 建立 SLS_PI。
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { decrypt } from '@/lib/crypto'
import { callLLM, buildMessagesForFile, parseJsonResponse } from '@/lib/ai-llm'

export interface ParsedPI {
  piNo?: string | null               // 我方 PI 號
  issueDate?: string | null          // YYYY-MM-DD，PI 開立日
  estimatedShipDate?: string | null  // YYYY-MM-DD，預計出貨日
  currency?: string | null           // USD / EUR / TWD …
  paymentTerms?: string | null
  items: {
    sku: string | null               // 型號/料號（最重要，用於對應訂單品項）
    name: string
    specification?: string | null
    qty: number
    unitPrice: number
    unit: string
  }[]
  notes?: string | null
}

const SYSTEM_PROMPT = `你是專業的貿易文件解析助理，負責解析「我方（賣方）發給客戶的 PI（Proforma Invoice，形式發票）」。

## 文件方向
- 這份文件是「賣方（我方）」發給「買方（客戶）」的形式發票。
- 賣方 = 文件的發行方（From / Issued by / Seller）。
- 買方 = 收件方（To / Bill To / Buyer）。

## 必抓欄位
- piNo: PI 號碼（通常格式如 PI-YYYYMMDD-XXXX 或公司自定格式）
- issueDate: PI 開立日期（YYYY-MM-DD）
- estimatedShipDate: 預計出貨日 / ETD（YYYY-MM-DD，找不到填 null）
- currency: 幣別（USD / EUR / TWD 等，找不到填 null）
- paymentTerms: 付款條件（T/T 30 days、L/C at sight 等，找不到填 null）

## 品項解析（最重要）
每個品項必須盡力找出：
- sku: 型號/料號/Item No.（這是最重要的欄位，找不到填 null，**絕對不可以用品名當 SKU**）
- name: 2-5 字的通用類別名稱，語言與 specification 一致，不含型號
- specification: 完整原始描述，保留所有細節
- qty: 數量（數字）
- unitPrice: 單價（數字）
- unit: 單位（PCS / SET / CTN / KGS，找不到預設 "PCS"）

## 輸出格式（只回傳 JSON，不加任何說明）
{
  "piNo": "PI 號碼或 null",
  "issueDate": "YYYY-MM-DD 或 null",
  "estimatedShipDate": "YYYY-MM-DD 或 null",
  "currency": "幣別或 null",
  "paymentTerms": "付款條件或 null",
  "items": [
    {
      "sku": "料號或 null",
      "name": "類別名稱",
      "specification": "完整原始描述",
      "qty": 數量,
      "unitPrice": 單價,
      "unit": "單位"
    }
  ],
  "notes": "備註或 null"
}`

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

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '未收到檔案' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const messages = await buildMessagesForFile(
      buffer, file.type, file.name,
      SYSTEM_PROMPT, '請解析這份 PI，回傳 JSON。', provider,
    )

    const raw = await callLLM(provider, apiKey, model, messages)
    const data = parseJsonResponse<ParsedPI>(raw)
    if (!Array.isArray(data.items)) data.items = []

    return NextResponse.json({ ok: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/ai/parse-pi]', msg)
    return NextResponse.json({ error: `解析失敗：${msg}` }, { status: 500 })
  }
}
