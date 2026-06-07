import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
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

    // 財務（最先刪，有外鍵指向採購/銷售）
    await prisma.fIN_Payable.deleteMany()
    await prisma.fIN_Receivable.deleteMany()

    // 銷售側（由子到父）
    await prisma.sLS_ShipmentItem.deleteMany()
    await prisma.sLS_Shipment.deleteMany()
    await prisma.sLS_PIItem.deleteMany()
    await prisma.sLS_PI.deleteMany()
    await prisma.sLS_Item.deleteMany()
    await prisma.sLS_Order.deleteMany()

    // 採購側（由子到父）
    await prisma.pO_SupplierPIItem.deleteMany()
    await prisma.pO_SupplierPI.deleteMany()
    await prisma.pO_ReceiptItem.deleteMany()
    await prisma.pO_Receipt.deleteMany()
    await prisma.pO_Item.deleteMany()
    await prisma.pO_Order.deleteMany()

    // 庫存
    await prisma.iNV_Movement.deleteMany()
    await prisma.iNV_Stock.deleteMany()

    // Patisco 同步紀錄
    await prisma.sYS_PatiscoSync.deleteMany()

    // 商品相關（及相依的關聯表）
    await prisma.cOST_Sheet.deleteMany()
    await prisma.pRD_ProductHistory.deleteMany()
    await prisma.pRD_CategoryMapping.deleteMany()
    await prisma.sUP_SupplierProduct.deleteMany()
    // CUS_CustomerProduct 有 FK 指向 PRD_Product 和 CUS_Customer，先刪
    await prisma.cUS_CustomerProduct.deleteMany()
    await prisma.pRD_Product.deleteMany()

    // 供應商、客戶
    await prisma.sUP_Contact.deleteMany()
    await prisma.sUP_Supplier.deleteMany()
    await prisma.cUS_Contact.deleteMany()
    await prisma.cUS_Customer.deleteMany()

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/dev/clear-all]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
