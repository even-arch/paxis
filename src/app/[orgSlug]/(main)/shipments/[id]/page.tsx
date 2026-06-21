export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPagePrisma } from '@/lib/page-db'
import { orgPath } from '@/lib/org-path'
import { formatDate } from '@/lib/utils'
import ShipmentItemTable, { type ShipmentGroupData } from './ShipmentItemTable'
import ConfirmShipmentButton from './ConfirmShipmentButton'
import LinkPOButton from '@/app/[orgSlug]/(main)/sales/pi/[piId]/LinkPOButton'

type Props = { params: { orgSlug: string; id: string } }

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 text-sm w-32 shrink-0">{label}</span>
      <span className="text-gray-800 text-sm">{value ?? '-'}</span>
    </div>
  )
}

export default async function ShipmentDetailPage({ params }: Props) {
  const prisma = await getPagePrisma(params.orgSlug)
  const id = parseInt(params.id, 10)
  if (isNaN(id)) notFound()

  const shipment = await prisma.sLS.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, shortName: true } },
      stockMovements: { where: { type: 4 }, select: { id: true } },
      pis: {
        include: {
          pi: {
            select: {
              id: true, piNo: true, etd: true,
              order: { select: { id: true, orderNo: true } },
              poOrders: { select: { id: true, poNo: true, supplier: { select: { shortName: true, name: true } } } },
            },
          },
        },
      },
      items: {
        include: {
          slsItem: {
            select: {
              unit: true,
              product: { select: { sku: true, name: true } },
            },
          },
          pi: { select: { id: true, piNo: true, orderId: true, totalAmount: true, currencyCode: true } },
        },
        orderBy: [{ piId: 'asc' }, { id: 'asc' }],
      },
    },
  })

  if (!shipment) notFound()

  const SOURCE_LABELS: Record<string, string> = {
    PATISCO: 'Patisco', MANUAL: '手動', AI_IMPORT: 'AI 匯入', UPS: 'UPS',
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={orgPath(params.orgSlug, '/shipments')} className="text-gray-400 hover:text-gray-600 text-sm">← 出貨單列表</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-800 font-mono">{shipment.shipmentNo}</h1>
        <div className="ml-auto">
          <ConfirmShipmentButton
            shipmentId={shipment.id}
            alreadyConfirmed={shipment.stockMovements.length > 0}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">出貨資訊</h2>
          <Row label="出貨單號" value={<span className="font-mono">{shipment.shipmentNo}</span>} />
          <Row label="客戶" value={
            shipment.customer
              ? <Link href={orgPath(params.orgSlug, `/customers/${shipment.customer.id}`)} className="text-teal-600 hover:underline">
                  {shipment.customer.name}
                </Link>
              : '-'
          } />
          <Row label="出貨日期" value={formatDate(shipment.actualShipDate)} />
          <Row label="運送方式" value={shipment.shippingMethod} />
          <Row label="裝貨港" value={shipment.portOfLoading} />
          <Row label="卸貨港" value={shipment.portOfDischarge} />
          <Row label="追蹤號" value={shipment.trackingNo} />
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">文件資訊</h2>
          <Row label="商業發票號" value={shipment.commercialInvNo} />
          <Row label="裝箱單號" value={shipment.packingListNo} />
          <Row label="幣別" value={shipment.currencyCode} />
          {shipment.ciExchangeRate && (
            <Row label="CI 匯率" value={shipment.ciExchangeRate.toString()} />
          )}
          <Row label="來源" value={SOURCE_LABELS[shipment.source] ?? shipment.source} />
          {shipment.patiscoDocNo && (
            <Row label="Patisco 單號" value={<span className="font-mono text-xs">{shipment.patiscoDocNo}</span>} />
          )}
          <Row label="匯入日期" value={formatDate(shipment.performedAt)} />
          {shipment.note && <Row label="備註" value={shipment.note} />}
        </div>
      </div>

      {await (async () => {
        // 優先用 SLS_PI_Link junction table；若空（舊資料或 UPS 流程漏建），
        // 從 items.pi 推導唯一 PI 清單作為 fallback
        type PiEntry = { piId: number; piNo: string; orderId?: number | null; orderNo?: string | null; etd?: Date | null; poOrders: { id: number; poNo: string; supplier: { shortName: string | null; name: string } }[] }
        let piList: PiEntry[] = shipment.pis.map(sp => ({
          piId: sp.piId,
          piNo: sp.pi.piNo,
          orderId: sp.pi.order?.id,
          orderNo: sp.pi.order?.orderNo,
          etd: sp.pi.etd,
          poOrders: sp.pi.poOrders,
        }))
        if (piList.length === 0) {
          const seen = new Set<number>()
          for (const item of shipment.items) {
            if (item.pi && !seen.has(item.pi.id)) {
              seen.add(item.pi.id)
              piList.push({ piId: item.pi.id, piNo: item.pi.piNo, orderId: item.pi.orderId, poOrders: [] })
            }
          }
        }
        if (piList.length === 0) return null

        // 模糊補查：poNo 以 piNo 為前綴（含精確相等），補上 slsPiId FK 沒有抓到的拆單 PO
        // 例如 PI "E2620048" → 可對應 PO "E2620048-1"、"E2620048-2"、"E2620048-A"
        const fuzzyPOs = await prisma.pO.findMany({
          where: {
            OR: piList.map(p => ({ poNo: { startsWith: p.piNo } })),
            slsPiId: null,  // 已有 FK 連結的不重複撈
          },
          select: { id: true, poNo: true, slsPiId: true, supplier: { select: { shortName: true, name: true } } },
        })
        for (const pi of piList) {
          const matched = fuzzyPOs.filter(po => po.poNo === pi.piNo || po.poNo.startsWith(pi.piNo + '-') || /^[A-Z]$/.test(po.poNo.slice(pi.piNo.length)))
          for (const po of matched) {
            if (!pi.poOrders.find(p => p.id === po.id)) {
              pi.poOrders.push({ id: po.id, poNo: po.poNo, supplier: po.supplier })
            }
          }
        }

        const missingPO = piList.filter(p => p.poOrders.length === 0)
        return (
          <div className="bg-white rounded-lg shadow p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">關聯 PI</h2>
              {missingPO.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1">
                  ⚠ {missingPO.length} 張 PI 尚未連結採購單（PO）
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                  ✓ 全部 PI 均已連結 PO
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {piList.map(pi => {
                const hasPO = pi.poOrders.length > 0
                return (
                  <div key={pi.piId} className={`flex items-start gap-3 border rounded px-3 py-2 text-sm ${hasPO ? 'border-gray-200' : 'border-orange-300 bg-orange-50'}`}>
                    <span className={`mt-0.5 text-base ${hasPO ? 'text-green-500' : 'text-orange-500'}`}>{hasPO ? '✓' : '⚠'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={orgPath(params.orgSlug, `/sales/pi/${pi.piId}`)} className="font-mono text-teal-600 hover:underline font-medium">
                          {pi.piNo}
                        </Link>
                        {pi.etd && <span className="text-gray-400 text-xs">ETD: {formatDate(pi.etd)}</span>}
                      </div>
                      {hasPO ? (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {pi.poOrders.map(po => (
                            <Link key={po.id} href={orgPath(params.orgSlug, `/purchases/${po.id}`)}
                              className="text-xs text-blue-600 hover:underline font-mono">
                              PO: {po.poNo} <span className="text-gray-400 font-sans">({po.supplier.shortName ?? po.supplier.name})</span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center gap-3">
                          <span className="text-xs text-orange-700">尚未連結採購單</span>
                          <LinkPOButton piId={pi.piId} linkedPOIds={[]} initialQuery={pi.piNo} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {shipment.items.length > 0 && (() => {
        // 序列化 Decimal → string，以 PI 分組，傳給 Client Component
        type Item = typeof shipment.items[number]
        const groupMap = new Map<string, ShipmentGroupData>()
        for (const item of shipment.items) {
          const key = item.piId != null ? String(item.piId) : '__none__'
          if (!groupMap.has(key)) {
            groupMap.set(key, {
              label: item.pi?.piNo ?? '未關聯 PI',
              piId: item.piId,
              piTotalAmount: item.pi?.totalAmount?.toString() ?? null,
              piCurrencyCode: item.pi?.currencyCode ?? null,
              items: [],
            })
          }
          const g = groupMap.get(key)!
          g.items.push({
            id: item.id,
            sku: item.slsItem?.product?.sku ?? item.rawSku ?? null,
            productName: item.slsItem?.product?.name ?? item.rawProductName ?? null,
            quantity: item.quantity,
            unit: (item as unknown as { unit?: string | null }).unit ?? item.slsItem?.unit ?? null,
            unitPrice: (item as unknown as { unitPrice?: { toString(): string } | null }).unitPrice?.toString() ?? null,
            grossWeightKg: item.grossWeightKg?.toString() ?? null,
            netWeightKg: item.netWeightKg?.toString() ?? null,
            cubicFt: item.cubicFt?.toString() ?? null,
            cbm: item.cbm?.toString() ?? null,
            cartons: item.cartons ?? null,
            cartonNoFrom: item.cartonNoFrom ?? null,
            cartonNoTo: item.cartonNoTo ?? null,
            hasSlsItem: !!item.slsItem,
            hasRawSku: !!item.rawSku,
            hasLinkedOrder: !!(item.slsItem || item.piId),
          })
        }
        const groups = Array.from(groupMap.values())

        return (
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">裝箱明細</h2>
            </div>
            <ShipmentItemTable groups={groups} shipmentCurrencyCode={shipment.currencyCode} />
          </div>
        )
      })()}

      {shipment.items.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
          尚無裝箱明細。若此出貨單來自 Patisco，請重新執行同步以拉取 Packing List 資料。
        </div>
      )}
    </div>
  )
}
