export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPagePrisma } from '@/lib/page-db'
import { orgPath } from '@/lib/org-path'
import { formatDate } from '@/lib/utils'

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

  const shipment = await prisma.sLS_Shipment.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, shortName: true } },
      pis: {
        include: {
          pi: {
            select: {
              id: true, piNo: true, etd: true,
              order: { select: { id: true, orderNo: true } },
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
          pi: { select: { id: true, piNo: true, orderId: true } },
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

      {(() => {
        // 優先用 SLS_ShipmentPI junction table；若空（舊資料或 UPS 流程漏建），
        // 從 items.pi 推導唯一 PI 清單作為 fallback
        type PiEntry = { piId: number; piNo: string; orderId?: number | null; orderNo?: string | null; etd?: Date | null }
        let piList: PiEntry[] = shipment.pis.map(sp => ({
          piId: sp.piId,
          piNo: sp.pi.piNo,
          orderId: sp.pi.order?.id,
          orderNo: sp.pi.order?.orderNo,
          etd: sp.pi.etd,
        }))
        if (piList.length === 0) {
          const seen = new Set<number>()
          for (const item of shipment.items) {
            if (item.pi && !seen.has(item.pi.id)) {
              seen.add(item.pi.id)
              piList.push({ piId: item.pi.id, piNo: item.pi.piNo, orderId: item.pi.orderId })
            }
          }
        }
        if (piList.length === 0) return null
        return (
          <div className="bg-white rounded-lg shadow p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">關聯 PI</h2>
            <div className="flex flex-wrap gap-2">
              {piList.map(pi => (
                <div key={pi.piId} className="border border-gray-200 rounded px-3 py-2 text-sm">
                  <Link href={orgPath(params.orgSlug, `/sales/${pi.orderId ?? ''}`)} className="font-mono text-teal-600 hover:underline">
                    {pi.piNo}
                  </Link>
                  {pi.orderNo && (
                    <span className="text-gray-400 text-xs ml-2">(訂單 {pi.orderNo})</span>
                  )}
                  {pi.etd && (
                    <span className="text-gray-400 text-xs ml-2">ETD: {formatDate(pi.etd)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {shipment.items.length > 0 && (() => {
        // 以 PI 為單位分組（piId=null 的歸到 '未關聯' 群組）
        type Item = typeof shipment.items[number]
        const groups = new Map<string, { label: string; piId: number | null; items: Item[] }>()
        for (const item of shipment.items) {
          const key = item.piId != null ? String(item.piId) : '__none__'
          if (!groups.has(key)) {
            groups.set(key, {
              label: item.pi?.piNo ?? '未關聯 PI',
              piId: item.piId,
              items: [],
            })
          }
          groups.get(key)!.items.push(item)
        }
        const groupList = Array.from(groups.values())
        const multiGroup = groupList.length > 1

        const cartonLabel = (item: Item) => {
          if (!item.cartonNoFrom) return '-'
          if (item.cartonNoTo && item.cartonNoTo !== item.cartonNoFrom)
            return `${item.cartonNoFrom}–${item.cartonNoTo}`
          return item.cartonNoFrom
        }

        // 每個 PI 群組的加總（按 distinct 箱號去重）
        const groupSummary = (items: Item[]) => {
          const totalQty = items.reduce((s, i) => s + i.quantity, 0)
          // 同一箱號只算一次重量/材積（多品項共箱）
          const seenBoxes = new Map<string, Item>()
          for (const i of items) {
            const key = i.cartonNoFrom ?? `__item_${i.id}`
            if (!seenBoxes.has(key)) seenBoxes.set(key, i)
          }
          const distinctBoxes = Array.from(seenBoxes.values())
          const allNums = items.map(i => i.cartonNoFrom).filter(Boolean).map(Number).filter(n => !isNaN(n))
          const minBox = allNums.length ? Math.min(...allNums) : null
          const maxNums = items.map(i => i.cartonNoTo ?? i.cartonNoFrom).filter(Boolean).map(Number).filter(n => !isNaN(n))
          const maxBox = maxNums.length ? Math.max(...maxNums) : null
          // 箱數 = 最大箱號 - 最小箱號 + 1（C/NO. 範圍）；沒有箱號時 fallback 加總各列 cartons
          const totalCartons: number | null = (minBox != null && maxBox != null)
            ? maxBox - minBox + 1
            : (items.reduce((s, i) => s + (i.cartons ?? 0), 0) || null)
          const totalGW  = distinctBoxes.reduce((s, i) => s + Number(i.grossWeightKg ?? 0), 0)
          const totalNW  = distinctBoxes.reduce((s, i) => s + Number(i.netWeightKg ?? 0), 0)
          const totalFt3 = distinctBoxes.reduce((s, i) => s + Number(i.cubicFt ?? 0), 0)
          const totalCbm = distinctBoxes.reduce((s, i) => s + Number(i.cbm ?? 0), 0)
          const rangeLabel = minBox != null && maxBox != null
            ? minBox === maxBox ? String(minBox) : `${minBox}–${maxBox}`
            : '-'
          return { totalQty, totalCartons, rangeLabel, totalGW, totalNW, totalFt3, totalCbm }
        }

        const fmt = (n: number) => n > 0 ? n.toFixed(n % 1 === 0 ? 0 : 3).replace(/\.?0+$/, '') : '-'

        // 全單總計
        const grandTotalCartons = groupList.reduce((sum, group) => {
          const s = groupSummary(group.items)
          return sum + (s.totalCartons ?? 0)
        }, 0)
        // 數量按單位分群
        const qtyByUnit = new Map<string, number>()
        for (const item of shipment.items) {
          const unit = item.slsItem?.unit?.trim() || 'PC'
          qtyByUnit.set(unit, (qtyByUnit.get(unit) ?? 0) + item.quantity)
        }
        const unitEntries = Array.from(qtyByUnit.entries()).sort((a, b) => b[1] - a[1])
        // 全單重量/材積加總（每個 PI 組內去重）
        let grandGW = 0, grandNW = 0, grandFt3 = 0, grandCbm = 0
        for (const group of groupList) {
          const s = groupSummary(group.items)
          grandGW += s.totalGW
          grandNW += s.totalNW
          grandFt3 += s.totalFt3
          grandCbm += s.totalCbm
        }

        return (
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">裝箱明細</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">PI / SKU</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">品名</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">數量</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">箱數</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600">C/NO.</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">毛重 (kg)</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">淨重 (kg)</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">ft³</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">m³</th>
                </tr>
              </thead>
              <tbody>
                {groupList.map((group, gi) => {
                  const s = groupSummary(group.items)
                  const showSubtotal = group.items.length > 1
                  return (
                    <>
                      {group.items.map((item, ii) => (
                        <tr key={item.id} className={`border-t ${ii === 0 ? 'border-t-2 border-teal-200 bg-teal-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                          <td className="px-4 py-2 align-top">
                            {multiGroup && ii === 0 && (
                              <div className="text-xs font-bold text-teal-700 font-mono whitespace-nowrap mb-0.5">{group.label}</div>
                            )}
                            <div className="font-mono text-xs text-gray-600 whitespace-nowrap">
                              {item.slsItem?.product?.sku ?? item.rawSku ?? '-'}
                              {!item.slsItem && item.rawSku && (
                                <span className="ml-1 text-amber-500 text-xs" title="此 SKU 尚未連結至銷售品項（SLS_Item 為 null）">⚠</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-gray-700 text-xs">
                            {item.slsItem?.product?.name ?? item.rawProductName ?? '-'}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-700">
                            {item.quantity.toLocaleString()}
                            {item.slsItem?.unit && <span className="text-gray-400 text-xs ml-1">{item.slsItem.unit}</span>}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-500">{item.cartons ?? '-'}</td>
                          <td className="px-4 py-2 text-center text-gray-500 text-xs font-mono">{cartonLabel(item)}</td>
                          <td className="px-4 py-2 text-right text-gray-500 text-xs">{item.grossWeightKg?.toString() ?? '-'}</td>
                          <td className="px-4 py-2 text-right text-gray-500 text-xs">{item.netWeightKg?.toString() ?? '-'}</td>
                          <td className="px-4 py-2 text-right text-gray-500 text-xs">{item.cubicFt?.toString() ?? '-'}</td>
                          <td className="px-4 py-2 text-right text-gray-500 text-xs">{item.cbm?.toString() ?? '-'}</td>
                        </tr>
                      ))}
                      {/* 小計列：品項超過 1 筆時才顯示 */}
                      {showSubtotal && (
                        <tr key={`sub-${gi}`} className="bg-teal-50 border-t border-teal-100">
                          <td colSpan={2} className="px-4 py-1.5 text-xs text-teal-600 font-medium">小計</td>
                          <td className="px-4 py-1.5 text-right text-xs font-semibold text-teal-800">{s.totalQty.toLocaleString()}</td>
                          <td className="px-4 py-1.5 text-right text-xs font-semibold text-teal-800">{(s.totalCartons ?? 0) > 0 ? s.totalCartons : '-'}</td>
                          <td className="px-4 py-1.5 text-center text-xs font-mono text-teal-700">{s.rangeLabel}</td>
                          <td className="px-4 py-1.5 text-right text-xs font-semibold text-teal-800">{fmt(s.totalGW)}</td>
                          <td className="px-4 py-1.5 text-right text-xs font-semibold text-teal-800">{fmt(s.totalNW)}</td>
                          <td className="px-4 py-1.5 text-right text-xs font-semibold text-teal-800">{fmt(s.totalFt3)}</td>
                          <td className="px-4 py-1.5 text-right text-xs font-semibold text-teal-800">{fmt(s.totalCbm)}</td>
                        </tr>
                      )}
                    </>
                  )
                })}
                {/* 全單總計列 */}
                {multiGroup && (
                  <tr className="bg-gray-800 border-t-2 border-gray-600">
                    <td colSpan={2} className="px-4 py-3 text-sm font-bold text-white">
                      TOTAL
                      <span className="ml-3 font-normal text-gray-300 text-xs">
                        {unitEntries.map(([unit, qty]) => `${qty.toLocaleString()} ${unit}`).join(' / ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white">
                      {shipment.items.reduce((s, i) => s + i.quantity, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white">{grandTotalCartons > 0 ? grandTotalCartons : '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-400 text-xs">—</td>
                    <td className="px-4 py-3 text-right font-bold text-white">{fmt(grandGW)}</td>
                    <td className="px-4 py-3 text-right font-bold text-white">{fmt(grandNW)}</td>
                    <td className="px-4 py-3 text-right font-bold text-white">{fmt(grandFt3)}</td>
                    <td className="px-4 py-3 text-right font-bold text-white">{fmt(grandCbm)}</td>
                  </tr>
                )}
              </tbody>
            </table>
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
