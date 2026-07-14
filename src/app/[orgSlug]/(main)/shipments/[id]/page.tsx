export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPagePrisma } from '@/lib/page-db'
import { orgPath } from '@/lib/org-path'
import { formatDate } from '@/lib/utils'
import ShipmentItemTable, { type ShipmentGroupData } from './ShipmentItemTable'
import ConfirmShipmentButton from './ConfirmShipmentButton'
import ShippingNoticePanel from './ShippingNoticePanel'
import SOImportButton from './SOImportButton'
import PIOrderPanel from './PIOrderPanel'

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
        orderBy: { sortOrder: 'asc' },
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

  // 建立 piList（依 SLS_PI_Link.sortOrder 排列），供 PIOrderPanel 與裝箱明細共用
  type PiEntry = import('./PIOrderPanel').PiEntry
  let piList: PiEntry[] = shipment.pis.map(sp => ({
    piId: sp.piId,
    piNo: sp.pi.piNo,
    orderId: sp.pi.order?.id,
    orderNo: sp.pi.order?.orderNo,
    etd: sp.pi.etd,
    poOrders: sp.pi.poOrders,
  }))
  if (piList.length === 0) {
    // fallback：從 items 推導（舊資料 / UPS 流程漏建 SLS_PI_Link）
    const seen = new Set<number>()
    for (const item of shipment.items) {
      if (item.pi && !seen.has(item.pi.id)) {
        seen.add(item.pi.id)
        piList.push({ piId: item.pi.id, piNo: item.pi.piNo, orderId: item.pi.orderId, poOrders: [] })
      }
    }
  }
  if (piList.length > 0) {
    // 模糊補查：poNo 以 piNo 為前綴，補上 slsPiId FK 沒抓到的拆單 PO
    const fuzzyPOs = await prisma.pO.findMany({
      where: {
        OR: piList.map(p => ({ poNo: { startsWith: p.piNo } })),
        slsPiId: null,
      },
      select: { id: true, poNo: true, slsPiId: true, supplier: { select: { shortName: true, name: true } } },
    })
    for (const pi of piList) {
      const matched = fuzzyPOs.filter(po =>
        po.poNo === pi.piNo ||
        po.poNo.startsWith(pi.piNo + '-') ||
        /^[A-Z]$/.test(po.poNo.slice(pi.piNo.length))
      )
      for (const po of matched) {
        if (!pi.poOrders.find(p => p.id === po.id)) {
          pi.poOrders.push({ id: po.id, poNo: po.poNo, supplier: po.supplier })
        }
      }
    }
  }

  const SOURCE_LABELS: Record<string, string> = {
    PATISCO: 'Patisco', MANUAL: '手動', AI_IMPORT: 'AI 匯入', UPS: 'UPS',
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={orgPath(params.orgSlug, '/shipments')} className="text-gray-400 hover:text-gray-600 text-sm">← 出貨單列表</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-800 font-mono">{shipment.shipmentNo}</h1>
        <div className="ml-auto flex items-center gap-2">
          {!shipment.trackingNo && (
            <Link
              href={orgPath(params.orgSlug, `/shipping?slsShipmentId=${shipment.id}`)}
              className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
              🚚 用 UPS 出貨
            </Link>
          )}
          {shipment.trackingNo && (
            <Link
              href={orgPath(params.orgSlug, `/shipping?slsShipmentId=${shipment.id}`)}
              className="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
              🚚 重新建 UPS 提單
            </Link>
          )}
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

      {piList.length > 0 && (
        <PIOrderPanel
          piList={piList}
          shipmentId={shipment.id}
          orgSlug={params.orgSlug}
        />
      )}

      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">船務資訊（SO）</h2>
          <SOImportButton
            shipmentId={shipment.id}
            hasSoData={!!(shipment.soNo || shipment.vesselVoyage || shipment.containerYard || shipment.forwarderName)}
          />
        </div>
        {shipment.soNo || shipment.vesselVoyage || shipment.containerYard ? (
          <div className="grid grid-cols-2 gap-x-8">
            <div>
              <Row label="S/O 號碼" value={shipment.soNo && <span className="font-mono">{shipment.soNo}</span>} />
              <Row label="船名 / 航次" value={shipment.vesselVoyage} />
              <Row label="船公司" value={shipment.shippingLine} />
              <Row label="貨櫃場" value={shipment.containerYard && <span className="font-medium text-indigo-700">{shipment.containerYard}</span>} />
              <Row label="Forwarder" value={shipment.forwarderName} />
            </div>
            <div>
              <Row label="結關日" value={formatDate(shipment.customsClosingDate)} />
              <Row label="進倉期間" value={
                (shipment.warehouseInFrom || shipment.warehouseInUntil)
                  ? `${formatDate(shipment.warehouseInFrom) ?? '?'} ～ ${formatDate(shipment.warehouseInUntil) ?? '?'}`
                  : null
              } />
              <Row label="ETD / ETA" value={
                (shipment.soEtd || shipment.soEta)
                  ? `${formatDate(shipment.soEtd) ?? '?'} → ${formatDate(shipment.soEta) ?? '?'}`
                  : null
              } />
              <Row label="收貨地" value={shipment.placeOfReceipt} />
            </div>
            {shipment.soNote && (
              <div className="col-span-2 mt-2 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1">SO 注意事項</p>
                <p className="text-xs text-gray-600 whitespace-pre-wrap">{shipment.soNote}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            尚未匯入 SO。收到報關行的裝船通知單後，按右上角按鈕上傳（支援 Word / PDF / Excel / 圖片），
            AI 會解析出 S/O 號碼、船名航次、結關日、貨櫃場、進倉期限，並自動帶入出貨通知單的交貨地點。
          </p>
        )}
      </div>

      <ShippingNoticePanel shipmentId={shipment.id} />

      {shipment.items.length > 0 && (() => {
        // 序列化 Decimal → string，以 PI 分組，傳給 Client Component
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
        // 依 piList 的 sortOrder 排列群組；未關聯 PI 的品項放最後
        const groups: ShipmentGroupData[] = [
          ...piList.map(p => groupMap.get(String(p.piId))).filter((g): g is ShipmentGroupData => g != null),
          ...(groupMap.has('__none__') ? [groupMap.get('__none__')!] : []),
        ]
        // fallback：若 piList 沒有涵蓋所有 piId（理論上不應發生），補上剩餘群組
        const covered = new Set(piList.map(p => String(p.piId)))
        groupMap.forEach((g, key) => {
          if (!covered.has(key) && key !== '__none__') groups.push(g)
        })

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
