import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPagePrisma } from '@/lib/page-db'
import { formatDate } from '@/lib/utils'
import { orgPath } from '@/lib/org-path'
import ShippingNoticeDetail from './ShippingNoticeDetail'
import { filterMarksForDocNos, findUnmatchedDocNos } from '@/lib/shipping-marks'

export default async function ShippingNoticeDetailPage({
  params,
}: {
  params: { orgSlug: string; id: string }
}) {
  const prisma = await getPagePrisma(params.orgSlug)
  const id = parseInt(params.id, 10)
  if (isNaN(id)) notFound()

  const notice = await prisma.pO_ShippingNotice.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, email: true, contactPerson: true, phoneNo: true, address: true, city: true, countryCode: true } },
      items: {
        include: {
          po: { select: { id: true, poNo: true, slsPi: { select: { piNo: true } } } },
          product: { select: { id: true, sku: true, name: true, unit: true } },
        },
      },
      performer: { select: { id: true, name: true } },
      sourceShipment: { select: { id: true, shipmentNo: true, containerYard: true, shippingMarks: true } },
    },
  })

  if (!notice) notFound()

  // 麥頭：依此供應商相關單號（PO 號 + 連結 PI 號）篩出對應的 Remark 區塊
  // （與 A4 列印、Email 相同邏輯，讓畫面上也看得到）
  const rawMarks = notice.sourceShipment?.shippingMarks ?? null
  const shippingMarks = rawMarks
    ? filterMarksForDocNos(
        rawMarks,
        notice.items.flatMap(it => [it.po.poNo, it.po.slsPi?.piNo].filter((s): s is string => !!s)),
      )
    : null

  // 差異警告：哪些 PO 在麥頭裡找不到對應區塊（常見原因：麥頭原文單號打錯字）
  // 一張 PO 的 PO 號或其連結 PI 號有任一對到就算有
  const marksUnmatchedPoNos = rawMarks
    ? Array.from(new Set(
        notice.items
          .filter(it => {
            const candidates = [it.po.poNo, it.po.slsPi?.piNo].filter((s): s is string => !!s)
            return findUnmatchedDocNos(rawMarks, candidates).length === candidates.length
          })
          .map(it => it.po.poNo),
      ))
    : []

  // ── 材積計算（完全複製印刷路由邏輯：cubicFt 是每箱值，需乘以箱數）─────────
  // boxCount：依 cartonNoFrom/To 範圍算箱數，與 /print/sn 的 boxCount() 一致
  function boxCount(from: string | null, to: string | null, cartons: number | null): number {
    const f = parseInt(from ?? '0') || 0
    const t = parseInt(to ?? from ?? '0') || f
    return f > 0 ? Math.max(1, t - f + 1) : (cartons ?? 1)
  }

  let itemCubicFt: number[] = notice.items.map(() => 0)
  let totalCubicFt = 0

  if (notice.sourceShipmentId) {
    const slsItems = await prisma.sLS_Item.findMany({
      where: { shipmentId: notice.sourceShipmentId },
      select: {
        rawSku: true,
        cubicFt: true,
        cbm: true,
        cartons: true,
        cartonNoFrom: true,
        cartonNoTo: true,
        pi: { select: { piNo: true } },
        slsItem: { select: { product: { select: { sku: true } } } },
      },
      orderBy: [{ piId: 'asc' }, { id: 'asc' }],
    })

    // 僅保留此通知單涉及的 SKU（與印刷路由 filter 完全相同）
    const noticeSkus = new Set(notice.items.map(it => it.product.sku).filter((s): s is string => !!s))
    const filtered = slsItems.filter(it => {
      const sku = it.rawSku ?? it.slsItem?.product?.sku
      return sku != null && noticeSkus.has(sku)
    })

    // 總計：每箱 cubicFt × 箱數；依 piNo:cartonNoFrom 去重（同箱含多 SKU 時不重複算）
    const seen = new Set<string>()
    filtered.forEach((it, idx) => {
      const key = `${it.pi?.piNo ?? ''}:${it.cartonNoFrom ?? `__null_${idx}`}`
      if (seen.has(key)) return
      seen.add(key)
      const boxes = boxCount(it.cartonNoFrom, it.cartonNoTo, it.cartons)
      const ft = it.cubicFt ? Number(it.cubicFt) * boxes : it.cbm ? Number(it.cbm) * 35.3147 * boxes : 0
      totalCubicFt += ft
    })

    // 每 SKU 累計（不去重）：用於在通知單品項列顯示
    const skuFtMap = new Map<string, number>()
    for (const it of filtered) {
      const sku = it.rawSku ?? it.slsItem?.product?.sku
      if (!sku) continue
      const boxes = boxCount(it.cartonNoFrom, it.cartonNoTo, it.cartons)
      const ft = it.cubicFt ? Number(it.cubicFt) * boxes : it.cbm ? Number(it.cbm) * 35.3147 * boxes : 0
      skuFtMap.set(sku, (skuFtMap.get(sku) ?? 0) + ft)
    }

    // 同 SKU 出現在多張 PO 時，依 notifiedQuantity 比例分配到各列
    const skuQtyMap = new Map<string, number>()
    for (const it of notice.items) {
      if (!it.product.sku) continue
      skuQtyMap.set(it.product.sku, (skuQtyMap.get(it.product.sku) ?? 0) + it.notifiedQuantity)
    }

    itemCubicFt = notice.items.map(it => {
      const sku = it.product.sku
      if (!sku) return 0
      const skuTotal = skuFtMap.get(sku) ?? 0
      const skuQty = skuQtyMap.get(sku) ?? 0
      if (skuTotal === 0 || skuQty === 0) return 0
      return skuTotal * it.notifiedQuantity / skuQty
    })
  }

  // Decimal → string，避免 Server → Client 序列化錯誤
  const serialized = {
    ...notice,
    items: notice.items.map(it => ({ ...it, unitPrice: it.unitPrice?.toString() ?? null })),
  }

  // ── 交貨地點快速代入的預設資料 ──────────────────────────────────────────
  const session = await getServerSession(authOptions)
  const company = await prisma.sYS_Company.findFirst({
    select: { nameZh: true, nameEn: true, addressZh: true, addressEn: true, city: true, phone: true },
  })

  // 同一張出貨單的其他供應商（集貨供應商候選：貨可能出到其中一家）
  const siblingSuppliers = notice.sourceShipmentId
    ? (await prisma.pO_ShippingNotice.findMany({
        where: { sourceShipmentId: notice.sourceShipmentId, supplierId: { not: notice.supplierId } },
        select: {
          supplier: {
            select: { id: true, name: true, shortName: true, address: true, city: true, contactPerson: true, phoneNo: true },
          },
        },
        distinct: ['supplierId'],
      })).map(n => n.supplier)
    : []

  const deliverPresets = {
    office: company ? {
      name: company.nameZh || company.nameEn,
      address: [company.addressZh || company.addressEn, company.city].filter(Boolean).join(', '),
      contact: [session?.user?.name, company.phone].filter(Boolean).join(' '),
    } : null,
    containerYard: notice.sourceShipment?.containerYard ?? null,
    suppliers: siblingSuppliers.map(s => ({
      id: s.id,
      label: s.shortName ?? s.name,
      name: s.name,
      address: [s.address, s.city].filter(Boolean).join(', '),
      contact: [s.contactPerson, s.phoneNo].filter(Boolean).join(' '),
    })),
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={orgPath(params.orgSlug, '/purchases/shipping-notices')} className="text-gray-400 hover:text-gray-600 text-sm">
          ← 通知單列表
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-800 font-mono">{notice.noticeNo}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full ${notice.status === 'DRAFT' ? 'bg-gray-100 text-gray-600' : notice.status === 'SENT' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
          {notice.status === 'DRAFT' ? '草稿' : notice.status === 'SENT' ? '已寄送' : '已確認'}
        </span>
      </div>

      <ShippingNoticeDetail
        notice={serialized}
        deliverPresets={deliverPresets}
        shippingMarks={shippingMarks}
        marksUnmatchedPoNos={marksUnmatchedPoNos}
        itemCubicFt={itemCubicFt}
        totalCubicFt={totalCubicFt}
      />
    </div>
  )
}
