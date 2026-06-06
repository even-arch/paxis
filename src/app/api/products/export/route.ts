import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PRODUCT_COLUMNS } from '@/lib/productColumns'

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const ids = searchParams.get('ids')?.split(',').map(Number).filter(Boolean)
  const archived = searchParams.get('archived') === 'true'

  const products = await prisma.pRD_Product.findMany({
    where: {
      isActive: true,
      isArchived: archived,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    orderBy: [{ sku: 'asc' }, { name: 'asc' }],
  })

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as {
    utils: {
      book_new: () => unknown
      aoa_to_sheet: (data: unknown[][]) => unknown
      book_append_sheet: (wb: unknown, ws: unknown, name: string) => void
    }
    write: (wb: unknown, opts: { type: string; bookType: string }) => Buffer
  }

  const header = PRODUCT_COLUMNS.map(c => c.label)
  const rows = products.map(p => PRODUCT_COLUMNS.map(c => {
    const v = (p as Record<string, unknown>)[c.key]
    if (typeof v === 'boolean') return v ? 'Y' : 'N'
    if (v === null || v === undefined) return ''
    return String(v)
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  XLSX.utils.book_append_sheet(wb, ws, 'Products')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="products_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
