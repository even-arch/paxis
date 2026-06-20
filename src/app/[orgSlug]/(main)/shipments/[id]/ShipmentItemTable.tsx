'use client'

import { useState } from 'react'

export type ShipmentItemData = {
  id: number
  sku: string | null
  productName: string | null
  quantity: number
  unit: string | null
  unitPrice: string | null   // Decimal serialised as string
  grossWeightKg: string | null
  netWeightKg: string | null
  cubicFt: string | null
  cbm: string | null
  cartons: number | null
  cartonNoFrom: string | null
  cartonNoTo: string | null
  hasSlsItem: boolean
  hasRawSku: boolean
}

export type ShipmentGroupData = {
  label: string
  piId: number | null
  piTotalAmount: string | null   // Decimal serialised as string
  piCurrencyCode: string | null
  items: ShipmentItemData[]
}

type Props = {
  groups: ShipmentGroupData[]
  shipmentCurrencyCode: string | null
}

const fmt = (n: number) =>
  n > 0 ? n.toFixed(n % 1 === 0 ? 0 : 3).replace(/\.?0+$/, '') : '-'

const fmtMoney = (s: string | null) => {
  if (!s) return null
  const n = parseFloat(s)
  if (isNaN(n) || n === 0) return null
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function cartonLabel(item: ShipmentItemData) {
  if (!item.cartonNoFrom) return '-'
  if (item.cartonNoTo && item.cartonNoTo !== item.cartonNoFrom)
    return `${item.cartonNoFrom}–${item.cartonNoTo}`
  return item.cartonNoFrom
}

function groupSummary(items: ShipmentItemData[]) {
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)
  const seenBoxes = new Map<string, ShipmentItemData>()
  for (const i of items) {
    const key = i.cartonNoFrom ?? `__item_${i.id}`
    if (!seenBoxes.has(key)) seenBoxes.set(key, i)
  }
  const distinctBoxes = Array.from(seenBoxes.values())
  const allNums = items.map(i => i.cartonNoFrom).filter(Boolean).map(Number).filter(n => !isNaN(n))
  const minBox = allNums.length ? Math.min(...allNums) : null
  const maxNums = items.map(i => i.cartonNoTo ?? i.cartonNoFrom).filter(Boolean).map(Number).filter(n => !isNaN(n))
  const maxBox = maxNums.length ? Math.max(...maxNums) : null
  const totalCartons: number | null = (minBox != null && maxBox != null)
    ? maxBox - minBox + 1
    : (items.reduce((s, i) => s + (i.cartons ?? 0), 0) || null)
  const totalGW  = distinctBoxes.reduce((s, i) => s + parseFloat(i.grossWeightKg ?? '0'), 0)
  const totalNW  = distinctBoxes.reduce((s, i) => s + parseFloat(i.netWeightKg ?? '0'), 0)
  const totalFt3 = distinctBoxes.reduce((s, i) => s + parseFloat(i.cubicFt ?? '0'), 0)
  const totalCbm = distinctBoxes.reduce((s, i) => s + parseFloat(i.cbm ?? '0'), 0)
  const rangeLabel = minBox != null && maxBox != null
    ? minBox === maxBox ? String(minBox) : `${minBox}–${maxBox}`
    : '-'
  return { totalQty, totalCartons, rangeLabel, totalGW, totalNW, totalFt3, totalCbm }
}

export default function ShipmentItemTable({ groups, shipmentCurrencyCode }: Props) {
  const [volUnit, setVolUnit] = useState<'ft3' | 'm3'>('ft3')

  const multiGroup = groups.length > 1
  const allItems = groups.flatMap(g => g.items)

  // 全單重量/材積（每組內去重）
  let grandGW = 0, grandNW = 0, grandFt3 = 0, grandCbm = 0, grandCartons = 0
  for (const group of groups) {
    const s = groupSummary(group.items)
    grandGW += s.totalGW
    grandNW += s.totalNW
    grandFt3 += s.totalFt3
    grandCbm += s.totalCbm
    grandCartons += s.totalCartons ?? 0
  }

  // 數量按單位分群（用於底部總計）
  const qtyByUnit = new Map<string, number>()
  for (const item of allItems) {
    const u = item.unit?.trim() || 'PC'
    qtyByUnit.set(u, (qtyByUnit.get(u) ?? 0) + item.quantity)
  }
  const unitEntries = Array.from(qtyByUnit.entries()).sort((a, b) => b[1] - a[1])

  const volHeader = (
    <div className="flex flex-col items-end gap-1">
      <span>材積</span>
      <button
        onClick={() => setVolUnit(v => v === 'ft3' ? 'm3' : 'ft3')}
        className="text-[10px] bg-gray-200 hover:bg-gray-300 rounded px-1.5 py-0.5 font-mono text-gray-500 leading-none"
      >
        {volUnit === 'ft3' ? 'ft³ ⇌ m³' : 'm³ ⇌ ft³'}
      </button>
    </div>
  )

  const volCell = (item: ShipmentItemData) =>
    volUnit === 'ft3'
      ? (item.cubicFt ? parseFloat(item.cubicFt).toFixed(3).replace(/\.?0+$/, '') : '-')
      : (item.cbm ? parseFloat(item.cbm).toFixed(4).replace(/\.?0+$/, '') : '-')

  const volGroupTotal = (s: ReturnType<typeof groupSummary>) =>
    volUnit === 'ft3' ? fmt(s.totalFt3) : fmt(s.totalCbm)

  const volGrandTotal = volUnit === 'ft3' ? fmt(grandFt3) : fmt(grandCbm)

  // colspan count: SKU 品名 數量 單位 單價 總價 箱數 C/NO. 毛重 淨重 體積 = 11
  const TOTAL_COLS = 11

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-2 font-medium text-gray-600 w-28">SKU</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">品名</th>
            <th className="text-right px-4 py-2 font-medium text-gray-600 w-16">數量</th>
            <th className="text-center px-4 py-2 font-medium text-gray-600 w-14">單位</th>
            <th className="text-right px-3 py-2 font-medium text-gray-600 w-24">
              單價{shipmentCurrencyCode ? <span className="text-gray-400 font-normal ml-1">({shipmentCurrencyCode})</span> : ''}
            </th>
            <th className="text-right px-3 py-2 font-medium text-gray-600 w-36">
              總價{shipmentCurrencyCode ? <span className="text-gray-400 font-normal ml-1">({shipmentCurrencyCode})</span> : ''}
            </th>
            <th className="text-right px-3 py-2 font-medium text-gray-600 w-14">箱數</th>
            <th className="text-center px-3 py-2 font-medium text-gray-600 w-20">C/NO.</th>
            <th className="text-right px-3 py-2 font-medium text-gray-600 w-16">毛重 (kg)</th>
            <th className="text-right px-3 py-2 font-medium text-gray-600 w-16">淨重 (kg)</th>
            <th className="text-right px-3 py-2 font-medium text-gray-600 w-20">{volHeader}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group, gi) => {
            const s = groupSummary(group.items)
            const piAmtLabel = fmtMoney(group.piTotalAmount)
            const groupUnitMap = new Map<string, number>()
            for (const item of group.items) {
              const u = item.unit?.trim() || 'PC'
              groupUnitMap.set(u, (groupUnitMap.get(u) ?? 0) + item.quantity)
            }
            const groupUnitLabel = Array.from(groupUnitMap.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([u, q]) => `${q.toLocaleString()} ${u}`)
              .join(' / ')

            return (
              <>
                {/* PI 標題列 */}
                {multiGroup && (
                  <tr key={`pi-${gi}`} className="border-t-2 border-teal-200 bg-teal-50">
                    <td className="px-4 py-2 text-xs font-bold text-teal-700 font-mono whitespace-nowrap">{group.label}</td>
                    <td className="px-4 py-2 text-xs text-teal-600">{groupUnitLabel}</td>
                    <td className="px-4 py-2 text-right text-xs font-semibold text-teal-800">{s.totalQty.toLocaleString()}</td>
                    <td />
                    <td />
                    <td className="px-4 py-2 text-right text-xs font-semibold text-teal-800 whitespace-nowrap">{piAmtLabel ?? '-'}</td>
                    <td className="px-4 py-2 text-right text-xs font-semibold text-teal-800">{(s.totalCartons ?? 0) > 0 ? s.totalCartons : '-'}</td>
                    <td className="px-4 py-2 text-center text-xs font-mono text-teal-700">{s.rangeLabel}</td>
                    <td className="px-4 py-2 text-right text-xs font-semibold text-teal-800">{fmt(s.totalGW)}</td>
                    <td className="px-4 py-2 text-right text-xs font-semibold text-teal-800">{fmt(s.totalNW)}</td>
                    <td className="px-4 py-2 text-right text-xs font-semibold text-teal-800">{volGroupTotal(s)}</td>
                  </tr>
                )}
                {/* SKU 明細列 */}
                {group.items.map(item => {
                  const totalPrice = item.unitPrice
                    ? (parseFloat(item.unitPrice) * item.quantity).toFixed(2)
                    : null
                  return (
                    <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs text-gray-600 whitespace-nowrap pl-6">
                        {item.sku ?? '-'}
                        {!item.hasSlsItem && item.hasRawSku && (
                          <span className="ml-1 text-amber-500" title="此 SKU 尚未連結至銷售品項">⚠</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-700 text-xs">{item.productName ?? '-'}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{item.quantity.toLocaleString()}</td>
                      <td className="px-4 py-2 text-center text-gray-500 text-xs">{item.unit ?? '-'}</td>
                      <td className="px-3 py-2 text-right text-gray-500 text-xs font-mono">
                        {item.unitPrice ? parseFloat(item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600 text-xs font-mono">
                        {totalPrice ? parseFloat(totalPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">{item.cartons ?? '-'}</td>
                      <td className="px-3 py-2 text-center text-gray-500 text-xs font-mono">{cartonLabel(item)}</td>
                      <td className="px-3 py-2 text-right text-gray-500 text-xs">{item.grossWeightKg ? parseFloat(item.grossWeightKg).toString() : '-'}</td>
                      <td className="px-3 py-2 text-right text-gray-500 text-xs">{item.netWeightKg ? parseFloat(item.netWeightKg).toString() : '-'}</td>
                      <td className="px-3 py-2 text-right text-gray-500 text-xs font-mono">{volCell(item)}</td>
                    </tr>
                  )
                })}
              </>
            )
          })}
          {/* 全單總計列 */}
          <tr className="bg-gray-800 border-t-2 border-gray-600">
            <td colSpan={2} className="px-4 py-3 text-sm font-bold text-white">TOTAL</td>
            <td className="px-4 py-3 text-right font-bold text-white">
              {allItems.reduce((s, i) => s + i.quantity, 0).toLocaleString()}
            </td>
            <td colSpan={3} className="px-4 py-3 text-xs text-gray-300">
              {unitEntries.map(([u, q]) => `${q.toLocaleString()} ${u}`).join(' / ')}
            </td>
            <td className="px-4 py-3 text-right font-bold text-white">{grandCartons > 0 ? grandCartons : '-'}</td>
            <td className="px-4 py-3 text-center text-gray-400 text-xs">—</td>
            <td className="px-4 py-3 text-right font-bold text-white">{fmt(grandGW)}</td>
            <td className="px-4 py-3 text-right font-bold text-white">{fmt(grandNW)}</td>
            <td className="px-4 py-3 text-right font-bold text-white">{volGrandTotal}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
