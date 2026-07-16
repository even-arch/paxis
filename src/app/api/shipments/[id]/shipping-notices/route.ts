import { NextRequest, NextResponse } from 'next/server'
import { taipeiDateISO, taipeiDateCompact } from '@/lib/utils'
import { getRequestPrisma } from '@/lib/request-db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

type Params = { params: { id: string } }

// GET：列出此出貨單已產生的出貨通知單
export async function GET(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = Number(params.id)
  if (isNaN(shipmentId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const notices = await prisma.pO_ShippingNotice.findMany({
    where: { sourceShipmentId: shipmentId },
    include: {
      supplier: { select: { id: true, name: true, shortName: true, email: true } },
      items: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ notices })
}

// POST：由出貨單驅動，依供應商分組產生出貨通知單（草稿）
// 資料來源：出貨單關聯的 PI → PI.poOrders（slsPiId FK）→ 各 PO 的供應商與品項
export async function POST(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawId = session?.user ? (session.user as unknown as { id?: number | string }).id : null
  const userId = rawId != null ? Number(rawId) : null

  const shipmentId = Number(params.id)
  if (isNaN(shipmentId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const shipment = await prisma.sLS.findUnique({
    where: { id: shipmentId },
    include: {
      // SO 船務資料（自動帶入通知單交貨地點/期限）在 scalar 欄位上，include 自動包含
      pis: {
        include: {
          pi: {
            select: {
              id: true,
              piNo: true,
              poOrders: {
                select: {
                  id: true,
                  poNo: true,
                  supplierId: true,
                  supplier: { select: { id: true, name: true, shortName: true, email: true } },
                  items: {
                    select: {
                      productId: true,
                      quantity: true,
                      unit: true,
                      unitPrice: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!shipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 收集所有關聯 PO，依供應商分組（同一 PO 只算一次）
  type PoEntry = {
    id: number
    poNo: string
    supplierId: number
    supplier: { name: string; shortName: string | null }
    items: Array<{ productId: number; quantity: number; unit: string | null; unitPrice: unknown }>
  }
  const seenPoIds = new Set<number>()
  const allPos: PoEntry[] = []

  for (const link of shipment.pis) {
    for (const po of link.pi.poOrders) {
      if (seenPoIds.has(po.id)) continue
      seenPoIds.add(po.id)
      allPos.push(po)
    }
  }

  // 模糊補查：poNo 以 piNo 為前綴的拆單 PO（與出貨單頁面的顯示規則一致）
  // 例如 PI "E2620048" → PO "E2620048-1"、"E2620048-2"、"E2620048A"
  const piNos = shipment.pis.map(l => l.pi.piNo).filter(Boolean)
  if (piNos.length > 0) {
    const fuzzyPOs = await prisma.pO.findMany({
      where: {
        OR: piNos.map(no => ({ poNo: { startsWith: no } })),
        slsPiId: null,  // 已有 FK 連結的不重複撈
      },
      select: {
        id: true,
        poNo: true,
        supplierId: true,
        supplier: { select: { name: true, shortName: true } },
        items: { select: { productId: true, quantity: true, unit: true, unitPrice: true } },
      },
    })
    for (const po of fuzzyPOs) {
      if (seenPoIds.has(po.id)) continue
      const matched = piNos.some(no =>
        po.poNo === no || po.poNo.startsWith(no + '-') || /^[A-Z]$/.test(po.poNo.slice(no.length)))
      if (!matched) continue
      seenPoIds.add(po.id)
      allPos.push(po)
    }
  }

  const bySupplier = new Map<number, {
    supplierName: string
    pos: Array<Pick<PoEntry, 'id' | 'poNo' | 'items'>>
  }>()
  for (const po of allPos) {
    const entry = bySupplier.get(po.supplierId) ?? {
      supplierName: po.supplier.shortName ?? po.supplier.name,
      pos: [],
    }
    entry.pos.push({ id: po.id, poNo: po.poNo, items: po.items })
    bySupplier.set(po.supplierId, entry)
  }

  if (bySupplier.size === 0) {
    return NextResponse.json(
      { error: '此出貨單的 PI 尚未連結任何採購單（PO），請先在出貨單頁面連結 PO' },
      { status: 400 },
    )
  }

  // 已為此出貨單產生過通知單的供應商 → 跳過，不重複產生
  const existing = await prisma.pO_ShippingNotice.findMany({
    where: { sourceShipmentId: shipmentId },
    select: { id: true, noticeNo: true, supplierId: true },
  })
  const existingSupplierIds = new Set(existing.map(n => n.supplierId))

  const created: Array<{ id: number; noticeNo: string; supplierName: string }> = []
  const skipped: Array<{ supplierName: string; reason: string }> = []

  const today = taipeiDateCompact()
  let countToday = await prisma.pO_ShippingNotice.count({
    where: { noticeNo: { startsWith: `SN-${today}` } },
  })

  for (const [supplierId, group] of Array.from(bySupplier.entries())) {
    if (existingSupplierIds.has(supplierId)) {
      skipped.push({ supplierName: group.supplierName, reason: '已有通知單' })
      continue
    }

    const items = group.pos.flatMap(po =>
      po.items
        .filter(it => it.productId != null)
        .map(it => ({
          poId: po.id,
          productId: it.productId,
          poQuantity: it.quantity,
          notifiedQuantity: it.quantity,
          unit: it.unit ?? null,
          unitPrice: it.unitPrice != null ? String(it.unitPrice) : null,
        })),
    )

    if (items.length === 0) {
      skipped.push({ supplierName: group.supplierName, reason: 'PO 無品項' })
      continue
    }

    countToday++
    const noticeNo = `SN-${today}-${String(countToday).padStart(4, '0')}`

    // 交貨地點與期限：優先帶 SO 資料
    // 貨櫃場 → 交貨地點；最晚進倉期限 → 期望到貨日；S/O 號、船名、結關日 → 備註（進倉報關常用）
    const noteLines = [`由出貨單 ${shipment.shipmentNo} 產生`]
    if (shipment.soNo) noteLines.push(`S/O 號碼：${shipment.soNo}`)
    if (shipment.vesselVoyage) noteLines.push(`船名/航次：${shipment.vesselVoyage}`)
    if (shipment.customsClosingDate) {
      noteLines.push(`結關日：${taipeiDateISO(shipment.customsClosingDate)}`)
    }
    if (shipment.warehouseInUntil) {
      noteLines.push(`最晚進倉期限：${taipeiDateISO(shipment.warehouseInUntil)}`)
    }

    const notice = await prisma.pO_ShippingNotice.create({
      data: {
        noticeNo,
        supplierId,
        issueDate: new Date(),
        status: 'DRAFT',
        sourceShipmentId: shipmentId,
        deliverToName: shipment.containerYard ?? null,
        expectedDeliveryDate: shipment.warehouseInUntil ?? null,
        note: noteLines.join('\n'),
        performedBy: userId,
        items: { create: items },
      },
      select: { id: true, noticeNo: true },
    })

    created.push({ id: notice.id, noticeNo: notice.noticeNo, supplierName: group.supplierName })
  }

  return NextResponse.json({ created, skipped, existing })
}
