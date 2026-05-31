import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

// action: 'archive' | 'unarchive' | 'delete'
// delete 需要 password 驗證
export async function POST(req: NextRequest) {
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

      // 確認沒有未完成的採購單品項
      const activePoItems = await prisma.pO_Item.findMany({
        where: { productId: { in: ids }, order: { status: { in: [0, 1, 2] } } },
        select: { order: { select: { poNo: true } } },
      })
      if (activePoItems.length > 0) {
        const nos = Array.from(new Set(activePoItems.map(i => i.order.poNo))).join(', ')
        return NextResponse.json({
          error: `以下採購單尚未完成，無法刪除：${nos}`,
        }, { status: 400 })
      }

      // 刪除（cascade 依 Prisma 關聯設定）
      await prisma.pRD_Product.deleteMany({ where: { id: { in: ids } } })
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
