import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 暫時 debug — 直接測試 AI 設定是否能寫入 DB（不需 auth）
export async function GET() {
  try {
    const user = await prisma.sYS_User.findFirst({
      select: { id: true, aiProvider: true, aiParseModel: true, encryptedAiKey: true }
    })
    return NextResponse.json({ step: 'read ok', user: { id: user?.id, aiProvider: user?.aiProvider, hasKey: !!user?.encryptedAiKey } })
  } catch (err) {
    return NextResponse.json({ step: 'read failed', error: String(err) }, { status: 500 })
  }
}

export async function POST() {
  try {
    await prisma.sYS_User.update({
      where: { id: 1 },
      data: { aiProvider: 'openai', aiParseModel: null },
    })
    return NextResponse.json({ step: 'write ok' })
  } catch (err) {
    return NextResponse.json({ step: 'write failed', error: String(err) }, { status: 500 })
  }
}
