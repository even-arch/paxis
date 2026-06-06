import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { patiscoLogin, listTools } from '@/api/patisco/client'

/** 測試 Patisco 連線 */
export async function POST(_req: NextRequest) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await prisma.sYS_PatiscoConfig.findFirst({ where: { isActive: true } })
  if (!config) return NextResponse.json({ ok: false, error: '尚未設定 Patisco 帳號' }, { status: 400 })

  // 實際嘗試登入（傳入租戶 DB，確保讀到本帳號的設定）
  const creds = await patiscoLogin(prisma)
  const now = new Date()

  if (!creds) {
    await prisma.sYS_PatiscoConfig.update({
      where: { id: config.id },
      data: { lastTestedAt: now, lastTestStatus: 'error', lastTestMsg: '登入失敗，請確認帳號密碼' },
    })
    return NextResponse.json({ ok: false, error: '登入失敗，請確認帳號密碼' })
  }

  // 嘗試 tools/list 確認 API 正常
  const tools = await listTools(creds)
  const toolNames: string[] = tools?.result?.tools?.map((t: { name: string }) => t.name) ?? []

  await prisma.sYS_PatiscoConfig.update({
    where: { id: config.id },
    data: {
      lastTestedAt: now,
      lastTestStatus: 'ok',
      lastTestMsg: `連線成功，找到 ${toolNames.length} 個工具`,
    },
  })

  return NextResponse.json({
    ok: true,
    userId: creds.userId,
    tenantId: creds.tenantId,
    tools: toolNames,
    msg: `連線成功，找到 ${toolNames.length} 個工具`,
  })
}
