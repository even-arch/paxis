import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { patiscoLogin, listTools, listProformaInvoices } from '@/api/patisco/client'

/** 測試 Patisco 連線（end-to-end smoke test）
 *  三層驗證：登入 → tools/list → 實際資料查詢（拉 1 筆 PI）
 *  只有三層都通過，才算真正可用。
 */
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await prisma.sYS_PatiscoConfig.findFirst({ where: { isActive: true } })
  if (!config) return NextResponse.json({ ok: false, error: '尚未設定 Patisco 帳號' }, { status: 400 })

  const now = new Date()

  const fail = async (msg: string) => {
    await prisma.sYS_PatiscoConfig.update({
      where: { id: config.id },
      data: { lastTestedAt: now, lastTestStatus: 'error', lastTestMsg: msg },
    })
    return NextResponse.json({ ok: false, error: msg })
  }

  // 第一層：登入
  const creds = await patiscoLogin(prisma)
  if (!creds) return fail('登入失敗，請確認帳號密碼')

  // 第二層：tools/list（確認 MCP server 正常回應）
  let toolCount = 0
  try {
    const tools = await listTools(creds) as { result?: { tools?: { name: string }[] } } | null
    if (!tools) return fail('tools/list 無回應，MCP server 可能未啟動')
    toolCount = tools.result?.tools?.length ?? 0
    if (toolCount === 0) return fail('tools/list 回傳空結果，MCP server 可能異常')
  } catch (e) {
    return fail(`tools/list 失敗：${e instanceof Error ? e.message : String(e)}`)
  }

  // 第三層：實際資料查詢（拉第 1 頁 PI，驗證資料 API 可用）
  let piCount = 0
  try {
    const piList = await listProformaInvoices(creds, 1)
    if (!piList.ok) return fail(`PI 資料查詢失敗：${piList.error}`)
    piCount = piList.data?.items?.length ?? 0
  } catch (e) {
    return fail(`PI 資料查詢失敗：${e instanceof Error ? e.message : String(e)}`)
  }

  const msg = `連線正常｜${toolCount} 個工具｜PI 查詢回傳 ${piCount} 筆`
  await prisma.sYS_PatiscoConfig.update({
    where: { id: config.id },
    data: { lastTestedAt: now, lastTestStatus: 'ok', lastTestMsg: msg },
  })

  return NextResponse.json({
    ok: true,
    userId: creds.userId,
    tenantId: creds.tenantId,
    toolCount,
    piCount,
    msg,
  })
}
