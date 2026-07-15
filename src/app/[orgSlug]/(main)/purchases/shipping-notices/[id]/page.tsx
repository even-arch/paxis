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
      />
    </div>
  )
}
