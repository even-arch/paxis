import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { patiscoLogin, callWithAutoRelogin, listTools, listProformaInvoices } from '@/api/patisco/client'

/** 測試 Patisco 連線（end-to-end smoke test）
 *  三層驗證：登入 → tools/list → 實際資料查詢（拉 1 筆 PI）
 *  只有三層都通過，才算真正可用。
 */
export async function POST(_req: NextRequest) {
  const prisma = await getRequestPrisma()
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

  // 第二層：tools/list（僅供參考，不作為失敗條件）
  let toolCount = 0
  try {
    const tools = await listTools(creds) as { result?: { tools?: { name: string }[] } } | null
    toolCount = tools?.result?.tools?.length ?? 0
  } catch {
    // tools/list 失敗不中斷，繼續驗證實際資料查詢
  }

  // 第三層：實際資料查詢（拉第 1 頁 PI，驗證資料 API 可用；session 過期自動重新登入）
  let piCount = 0
  try {
    const piList = await callWithAutoRelogin(prisma, creds, (c) => listProformaInvoices(c, 1))
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
