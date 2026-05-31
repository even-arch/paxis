import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Excel 欄位定義（順序即 Excel 欄順序）
export const PRODUCT_COLUMNS = [
  { key: 'sku',             label: 'SKU / 料號',       required: true },
  { key: 'name',            label: '產品名稱',           required: true },
  { key: 'modelNo',         label: '型號',               required: false },
  { key: 'specification',   label: '規格說明',           required: false },
  { key: 'unit',            label: '單位',               required: true },
  { key: 'unitPerInner',    label: '每內箱數量',         required: false },
  { key: 'unitPerCarton',   label: '每外箱數量',         required: false },
  { key: 'cbm',             label: 'CBM（材積）',        required: false },
  { key: 'grossWeight',     label: '毛重 KGS',           required: false },
  { key: 'netWeight',       label: '淨重 KGS',           required: false },
  { key: 'length',          label: '長度 CM',            required: false },
  { key: 'width',           label: '寬度 CM',            required: false },
  { key: 'height',          label: '高度 CM',            required: false },
  { key: 'htsCode',         label: 'HTS / HS 編碼',     required: false },
  { key: 'countryOfOrigin', label: '原產地',             required: false },
  { key: 'isMadeToOrder',   label: '接單後採購 (Y/N)',   required: false },
  { key: 'safetyStock',     label: '安全庫存量',         required: false },
  { key: 'sellingPrice',    label: '建議售價',           required: false },
  { key: 'isAvailableForPos', label: 'POS 販售 (Y/N)',  required: false },
  { key: 'posProductId',    label: 'POS 產品 ID',        required: false },
] as const

export type ProductColumnKey = typeof PRODUCT_COLUMNS[number]['key']

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
