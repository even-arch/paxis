import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { callLLM } from '@/lib/ai-llm'
import type { Alert } from '../route'

/**
 * POST /api/finance/alerts/analyze
 * 把異常清單丟給 AI，取回繁體中文摘要與建議。
 * 只在使用者主動點擊時呼叫，不自動觸發。
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { alerts } = await req.json() as { alerts: Alert[] }
  if (!alerts || alerts.length === 0)
    return NextResponse.json({ summary: '目前沒有發現異常。' })

  // 取 AI 設定
  const user = await prisma.sYS_User.findFirst({
    select: { aiProvider: true, encryptedAiKey: true, aiParseModel: true },
  })
  if (!user?.aiProvider || !user?.encryptedAiKey)
    return NextResponse.json({ error: '尚未設定 AI 服務，請至「設定 → AI 功能」完成設定。' }, { status: 400 })

  const apiKey = decrypt(user.encryptedAiKey)
  const model = user.aiParseModel ?? (user.aiProvider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini')

  const alertText = alerts.map(a =>
    `【${a.shipmentNo}】毛利率 ${a.grossPct != null ? a.grossPct.toFixed(1) + '%' : '未知'}\n` +
    a.issues.map(i => `  - ${i}`).join('\n')
  ).join('\n\n')

  const prompt = `你是 PAXIS 貿易進銷存系統的財務助理。以下是系統自動偵測到的異常出貨單：

${alertText}

請用繁體中文針對每張出貨單：
1. 用一句話說明最可能的問題原因
2. 給出具體的建議操作步驟

回覆格式：每張出貨單一段，先寫出貨單號，再寫原因和建議。語氣簡潔專業，不超過 300 字。`

  try {
    const summary = await callLLM(
      user.aiProvider,
      apiKey,
      model,
      [{ role: 'user', content: prompt }],
      600,
    )
    return NextResponse.json({ summary })
  } catch (e) {
    return NextResponse.json({ error: `AI 分析失敗：${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
