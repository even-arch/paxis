import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { neon } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const prisma = await getRequestPrisma()
    try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { password } = await req.json() as { password?: string }
    if (!password) return NextResponse.json({ error: '請輸入密碼' }, { status: 400 })

    const userId = parseInt((session.user as { id?: string })?.id ?? '', 10)
    const user = await prisma.sYS_User.findUnique({ where: { id: userId }, select: { password: true } })
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // OAuth 帳號的 password 欄位為空字串，無法用 bcrypt 驗證
    // 改為：有 hash 就驗，空字串帳號拒絕（需先設定密碼才能使用此功能）
    if (!user.password) {
      return NextResponse.json({ error: '此帳號未設定密碼，無法驗證。請先在個人設定頁面設定密碼。' }, { status: 403 })
    }
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return NextResponse.json({ error: '密碼錯誤' }, { status: 403 })

    // TRUNCATE CASCADE 一次清空所有業務資料，比逐表 deleteMany 快很多
    const sql = neon(process.env.DATABASE_URL!)
    const tables = [
      'FIN_Payable', 'FIN_Receivable',
      'SLS_ShipmentItem', 'SLS_ShipmentPI', 'SLS_Shipment',
      'SLS_PIItem', 'SLS_PI', 'SLS_Item', 'SLS_Order',
      'PO_SupplierPIItem', 'PO_SupplierPI',
      'PO_ReceiptItem', 'PO_Receipt', 'PO_Item', 'PO_Order',
      'INV_Movement', 'INV_Stock',
      'SYS_PatiscoSync',
      'COST_Sheet', 'PRD_ProductHistory', 'PRD_CategoryMapping',
      'SUP_SupplierProduct', 'CUS_CustomerProduct', 'PRD_Product',
      'SUP_Contact', 'SUP_Supplier', 'CUS_Contact', 'CUS_Customer',
    ]
    const quoted = tables.map(t => `"${t}"`).join(', ')
    const query = `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`
    const tmpl = Object.assign([query], { raw: [query] }) as unknown as TemplateStringsArray
    await (sql as unknown as (t: TemplateStringsArray) => Promise<unknown>)(tmpl)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/dev/clear-all]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
