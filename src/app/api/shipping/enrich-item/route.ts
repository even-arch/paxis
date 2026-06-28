/**
 * POST /api/shipping/enrich-item
 * 對單一品項（specification / name）呼叫 AI，推導產品名稱與 HS Code。
 * 供 UPS 出貨頁在從 SLS 帶入時，對缺少名稱或 HS Code 的品項自動補齊。
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { callLLM, parseJsonResponse } from '@/lib/ai-llm'
import { decrypt } from '@/lib/crypto'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { specification, name, modelNo } = await req.json() as {
    specification?: string
    name?: string
    modelNo?: string
  }

  if (!specification && !name) {
    return NextResponse.json({ error: 'specification or name required' }, { status: 400 })
  }

  const prisma = await getRequestPrisma()
  const user = await prisma.sYS_User.findFirst({
    orderBy: { id: 'asc' },
    select: { aiProvider: true, encryptedAiKey: true, aiParseModel: true },
  })

  if (!user?.aiProvider || !user?.encryptedAiKey) {
    return NextResponse.json({ error: 'AI 未設定' }, { status: 503 })
  }

  let apiKey: string
  try { apiKey = decrypt(user.encryptedAiKey) } catch {
    return NextResponse.json({ error: 'AI 金鑰解密失敗' }, { status: 500 })
  }

  const model = user.aiParseModel
    || (user.aiProvider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini')

  const specText = specification || name || ''

  const prompt = `You are a customs and product classification expert for bicycle and cycling parts.

Given the specification or description below, derive:
1. A short product TYPE name (2-5 words, generic, e.g. "Bicycle Chain", "Rear Derailleur", "Brake Lever")
2. The 6-digit HS Code in XXXX.XX format

Key HS Code guidance for bicycle parts:
- Bicycle chains → 7315.11 or 7315.12
- Derailleurs, shifters, brakes, hubs, cranks, pedals, handlebars, saddles, forks → 8714.99
- Wheels, rims, spokes → 8714.92 or 8714.99
- Ball bearings → 8482.10
- Pulleys (non-bearing) → 8483.90
- Nuts, bolts, screws for bicycles → 7318.15 or 7318.16

Specification / description:
${specText}
${modelNo ? `Model No: ${modelNo}` : ''}

Rules for product name:
- Extract the product TYPE before any model number
- "CHAIN S512H ..." → "Bicycle Chain"
- "SHIFTER SLM2T ..." → "Gear Shifter"
- Do NOT use model numbers as the name
- Use the same language as the input

Respond ONLY with a JSON object, no markdown:
{"name": "product type", "htsCode": "XXXX.XX"}`

  try {
    const raw = await callLLM(user.aiProvider, apiKey, model, [
      { role: 'user', content: prompt },
    ], 256)
    const parsed = parseJsonResponse<{ name?: string; htsCode?: string }>(raw)

    const resultName = parsed.name?.trim() || null
    let resultHts = parsed.htsCode?.trim() || null

    // 標準化 HS Code 格式
    if (resultHts) {
      const digits = resultHts.replace(/\D/g, '')
      if (digits.length === 6) resultHts = `${digits.slice(0, 4)}.${digits.slice(4)}`
      else if (!/^\d{4}\.\d{2}$/.test(resultHts)) resultHts = null
    }

    return NextResponse.json({ ok: true, name: resultName, htsCode: resultHts })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
