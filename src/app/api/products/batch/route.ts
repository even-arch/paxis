import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import bcrypt from 'bcryptjs'

// action: 'archive' | 'unarchive' | 'delete'
// delete 需要 password 驗證
export async function POST(req: NextRequest) {
  const prisma = await getRequestPrisma()
    try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { ids, action, password } = await req.json() as {
      ids: number[]
      action: 'archive' | 'unarchive' | 'delete'
      password?: string
    }

    if (!ids?.length) return NextResponse.json({ error: '未指定產品' }, { status: 400 })
    if (!['archive', 'unarchive', 'delete'].includes(action)) {
      return NextResponse.json({ error: '無效操作' }, { status: 400 })
    }

    // 刪除需要密碼驗證
    if (action === 'delete') {
      if (!password) return NextResponse.json({ error: '刪除需要輸入密碼' }, { status: 400 })

      const userId = parseInt((session.user as { id?: string })?.id ?? '', 10)
      const user = await prisma.sYS_User.findUnique({ where: { id: userId }, select: { password: true } })
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const valid = await bcrypt.compare(password, user.password)
      if (!valid) return NextResponse.json({ error: '密碼錯誤' }, { status: 403 })

      // 依序刪除子資料再刪主資料（含採購/銷售明細）
      await prisma.$transaction([
        prisma.pRD_ProductHistory.deleteMany({ where: { productId: { in: ids } } }),
        prisma.pRD_CategoryMapping.deleteMany({ where: { productId: { in: ids } } }),
        prisma.sUP_SupplierProduct.deleteMany({ where: { productId: { in: ids } } }),
        prisma.iNV_Movement.deleteMany({ where: { productId: { in: ids } } }),
        prisma.iNV_Stock.deleteMany({ where: { productId: { in: ids } } }),
        prisma.cOST_Sheet.deleteMany({ where: { productId: { in: ids } } }),
        prisma.pO_Item.deleteMany({ where: { productId: { in: ids } } }),
        prisma.sLS_Item.deleteMany({ where: { productId: { in: ids } } }),
        prisma.pRD_Product.deleteMany({ where: { id: { in: ids } } }),
      ])
      return NextResponse.json({ ok: true, affected: ids.length })
    }

    // 封存 / 解封
    await prisma.pRD_Product.updateMany({
      where: { id: { in: ids } },
      data: { isArchived: action === 'archive' },
    })

    return NextResponse.json({ ok: true, affected: ids.length })

  } catch (err) {
    console.error('[POST /api/products/batch]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
