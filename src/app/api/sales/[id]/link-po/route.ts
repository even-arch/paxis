import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { decrypt } from '@/lib/crypto'
import { callLLM, buildMessagesForFile, parseJsonResponse } from '@/lib/ai-llm'

type Params = { params: { id: string } }

/**
 * PATCH /api/sales/[id]/link-po
 *
 * 兩種用途：
 * 1. 只傳 customerPoNo（JSON body）→ 直接更新訂單的客戶 PO 號
 * 2. 傳 multipart（含 PO 文件）→ AI 解析 PO，比對 SKU，儲存 customerPoNo + customerSkuRef
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const orderId = Number(params.id)
    const order = await prisma.pO_CustomerCopy.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
    })
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const contentType = req.headers.get('content-type') ?? ''

    // ── 模式 1：只更新 PO 號（JSON body）────────────────────────────────────
    if (!contentType.includes('multipart/form-data')) {
      const body = await req.json() as { customerPoNo?: string | null }
      await prisma.pO_CustomerCopy.update({
        where: { id: orderId },
        data: { customerPoNo: body.customerPoNo?.trim() || null },
      })
      return NextResponse.json({ ok: true, customerPoNo: body.customerPoNo?.trim() || null })
    }

    // ── 模式 2：上傳 PO 文件，AI 解析 SKU mapping ─────────────────────────────
    const user = await prisma.sYS_User.findUnique({
      where: { id: Number(session.user.id) },
      select: { aiProvider: true, encryptedAiKey: true, aiParseModel: true },
    })
    if (!user?.aiProvider || !user?.encryptedAiKey) {
      return NextResponse.json({ error: '請先在設定中登記 AI API Key' }, { status: 400 })
    }
    const apiKey = decrypt(user.encryptedAiKey)
    const provider = user.aiProvider
    const model = user.aiParseModel || (provider === 'anthropic' ? 'claude-opus-4-8' : 'gpt-4o')

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '未收到檔案' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    // 構建 context：告訴 AI 訂單現有的 SKU 列表
    const ourSkuList = order.items
      .map(i => `${i.product.sku ?? '(無SKU)'} — ${i.product.name}`)
      .join('\n')

    const SYSTEM_PROMPT = `你是一個貿易文件解析助理。
用戶提供的是「客戶發出的採購訂單（Customer PO）」。
請解析此文件，並將文件中的品項 SKU 對應到我方的產品。

## 我方現有產品清單（必須從中選取）
${ourSkuList}

## 解析目標
1. 找出客戶 PO 號碼（poNo）
2. 對每個 PO 品項，找出：
   - customerSku：客戶 PO 上的 SKU/料號
   - ourSku：對應到我方產品清單中最接近的 SKU（若無法對應填 null）
   - matchConfidence：比對信心度 "high" / "medium" / "low" / "none"
   - qty：訂購數量
   - unitPrice：單價

回傳 JSON：
{
  "poNo": "客戶PO號或null",
  "items": [
    {
      "customerSku": "客戶的SKU",
      "ourSku": "我方對應SKU或null",
      "matchConfidence": "high",
      "qty": 100,
      "unitPrice": 10.00
    }
  ]
}`

    const messages = await buildMessagesForFile(
      buffer, file.type, file.name,
      SYSTEM_PROMPT, '請解析此客戶採購訂單，回傳 JSON。', provider,
    )

    const raw = await callLLM(provider, apiKey, model, messages)

    interface ParsedPO {
      poNo?: string | null
      items: {
        customerSku: string
        ourSku: string | null
        matchConfidence: 'high' | 'medium' | 'low' | 'none'
        qty: number
        unitPrice: number
      }[]
    }
    const parsed = parseJsonResponse<ParsedPO>(raw)

    // 儲存 customerPoNo 到訂單
    const customerPoNo = parsed.poNo?.trim() || null
    await prisma.pO_CustomerCopy.update({
      where: { id: orderId },
      data: { customerPoNo },
    })

    // 儲存 customerSkuRef 到各品項（依 ourSku 配對）
    const updateResults: { ourSku: string | null; customerSku: string; saved: boolean }[] = []
    for (const pi of parsed.items ?? []) {
      if (!pi.ourSku || pi.matchConfidence === 'none') {
        updateResults.push({ ourSku: null, customerSku: pi.customerSku, saved: false })
        continue
      }
      const orderItem = order.items.find(i =>
        i.product.sku && i.product.sku.toLowerCase() === pi.ourSku!.toLowerCase()
      )
      if (orderItem) {
        await prisma.pO_CustomerCopy_Item.update({
          where: { id: orderItem.id },
          data: { customerSkuRef: pi.customerSku?.trim() || null },
        })
        updateResults.push({ ourSku: pi.ourSku, customerSku: pi.customerSku, saved: true })
      } else {
        updateResults.push({ ourSku: pi.ourSku, customerSku: pi.customerSku, saved: false })
      }
    }

    return NextResponse.json({
      ok: true,
      customerPoNo,
      mappings: updateResults,
      rawParsed: parsed,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[PATCH /api/sales/[id]/link-po]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
