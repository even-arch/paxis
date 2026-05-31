import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PRODUCT_COLUMNS } from '../export/route'

function parseBool(v: string): boolean {
  return v?.trim().toUpperCase() === 'Y'
}
function parseNum(v: string): number | null {
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}
function parseIntVal(v: string): number | null {
  const n = global.parseInt(v, 10)
  return isNaN(n) ? null : n
}
function str(v: string): string | null {
  return v?.trim() || null
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = parseIntVal((session.user as { id?: string })?.id ?? '')
    if (!userId || isNaN(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const fd = await req.formData()
    const file = fd.get('file') as File | null
    if (!file) return NextResponse.json({ error: '未收到檔案' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx') as {
      read: (b: Buffer, o: { type: string }) => { SheetNames: string[]; Sheets: Record<string, unknown> }
      utils: { sheet_to_json: (ws: unknown, o: { header: number; defval: string }) => string[][] }
    }
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    if (rows.length < 2) return NextResponse.json({ error: 'Excel 格式錯誤或無資料' }, { status: 400 })

    // 以第一行當 header，建立欄位索引
    const headerRow = rows[0].map(h => h.trim())
    const colIndex: Record<string, number> = {}
    for (const col of PRODUCT_COLUMNS) {
      const idx = headerRow.indexOf(col.label)
      if (idx !== -1) colIndex[col.key] = idx
    }

    if (colIndex['sku'] === undefined) {
      return NextResponse.json({ error: 'Excel 缺少「SKU / 料號」欄位（必填）' }, { status: 400 })
    }

    const results: Array<{
      sku: string; name: string
      action: 'updated' | 'skipped' | 'error'
      changes?: string[]
      reason?: string
    }> = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const sku = str(row[colIndex['sku']] ?? '')
      if (!sku) continue

      const product = await prisma.pRD_Product.findUnique({ where: { sku } })
      if (!product) {
        results.push({ sku, name: str(row[colIndex['name']] ?? '') ?? sku, action: 'skipped', reason: 'SKU 不存在，請先建立產品後再匯入' })
        continue
      }

      // 比較每個欄位
      const incoming: Record<string, unknown> = {
        name:              str(row[colIndex['name']] ?? '') ?? product.name,
        modelNo:           str(row[colIndex['modelNo']] ?? ''),
        specification:     str(row[colIndex['specification']] ?? ''),
        unit:              str(row[colIndex['unit']] ?? '') ?? product.unit,
        unitPerInner:      parseNum(row[colIndex['unitPerInner']] ?? ''),
        unitPerCarton:     parseNum(row[colIndex['unitPerCarton']] ?? ''),
        cbm:               parseNum(row[colIndex['cbm']] ?? ''),
        grossWeight:       parseNum(row[colIndex['grossWeight']] ?? ''),
        netWeight:         parseNum(row[colIndex['netWeight']] ?? ''),
        length:            parseNum(row[colIndex['length']] ?? ''),
        width:             parseNum(row[colIndex['width']] ?? ''),
        height:            parseNum(row[colIndex['height']] ?? ''),
        htsCode:           str(row[colIndex['htsCode']] ?? ''),
        countryOfOrigin:   str(row[colIndex['countryOfOrigin']] ?? ''),
        isMadeToOrder:     colIndex['isMadeToOrder'] !== undefined ? parseBool(row[colIndex['isMadeToOrder']] ?? '') : product.isMadeToOrder,
        safetyStock:       parseNum(row[colIndex['safetyStock']] ?? '') ?? product.safetyStock,
        sellingPrice:      parseNum(row[colIndex['sellingPrice']] ?? ''),
        isAvailableForPos: colIndex['isAvailableForPos'] !== undefined ? parseBool(row[colIndex['isAvailableForPos']] ?? '') : product.isAvailableForPos,
        posProductId:      str(row[colIndex['posProductId']] ?? ''),
      }

      // 找出有差異的欄位
      const changes: string[] = []
      const numericFields = ['unitPerInner','unitPerCarton','cbm','grossWeight','netWeight','length','width','height','safetyStock','sellingPrice']

      for (const [k, newVal] of Object.entries(incoming)) {
        const oldVal = (product as Record<string, unknown>)[k]
        const oldStr = oldVal === null || oldVal === undefined ? '' : String(oldVal)
        const newStr = newVal === null || newVal === undefined ? '' : String(newVal)

        if (numericFields.includes(k)) {
          const oldN = oldStr === '' ? null : parseFloat(oldStr)
          const newN = newStr === '' ? null : parseFloat(newStr)
          if (oldN !== newN) changes.push(k)
        } else {
          if (oldStr !== newStr) changes.push(k)
        }
      }

      if (changes.length === 0) {
        results.push({ sku, name: product.name, action: 'skipped', reason: '無變更' })
        continue
      }

      // 更新產品
      await prisma.pRD_Product.update({
        where: { sku },
        data: incoming as Parameters<typeof prisma.pRD_Product.update>[0]['data'],
      })

      // 寫歷史快照
      await prisma.pRD_ProductHistory.create({
        data: {
          productId: product.id,
          name: (incoming.name as string) ?? product.name,
          sku: product.sku,
          modelNo: (incoming.modelNo as string | null),
          specification: (incoming.specification as string | null),
          unit: (incoming.unit as string | null) ?? product.unit,
          unitPerInner: (incoming.unitPerInner as number | null),
          unitPerCarton: (incoming.unitPerCarton as number | null),
          cbm: (incoming.cbm as number | null),
          grossWeight: (incoming.grossWeight as number | null),
          netWeight: (incoming.netWeight as number | null),
          sourceType: 'MANUAL_EDIT',
          changedBy: userId,
        },
      })

      results.push({ sku, name: product.name, action: 'updated', changes })
    }

    const updated = results.filter(r => r.action === 'updated').length
    const skipped = results.filter(r => r.action === 'skipped').length

    return NextResponse.json({ ok: true, updated, skipped, results })

  } catch (err) {
    console.error('[POST /api/products/excel-import]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
