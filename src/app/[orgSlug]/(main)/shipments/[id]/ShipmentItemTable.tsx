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
  hasLinkedOrder: boolean
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

// ─── helpers ────────────────────────────────────────────────────────────────

const fmtNum = (n: number, dec = 3) =>
  n > 0 ? n.toFixed(dec).replace(/\.?0+$/, '') : '-'

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
  // 依 cartonNoFrom 去重，取同一箱號範圍的第一筆（GW/NW/CBM 是每箱值，重複品項都相同）
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
  const totalCartons = (minBox != null && maxBox != null)
    ? maxBox - minBox + 1
    : (items.reduce((s, i) => s + (i.cartons ?? 0), 0) || null)
  // GW/NW/CBM/ft3 是「每箱」值，需乘以該範圍的箱數才是總重
  const boxCount = (i: ShipmentItemData) => {
    const from = parseInt(i.cartonNoFrom ?? '0') || 0
    const to   = parseInt(i.cartonNoTo   ?? i.cartonNoFrom ?? '0') || from
    return from > 0 ? Math.max(1, to - from + 1) : (i.cartons ?? 1)
  }
  const totalGW  = distinctBoxes.reduce((s, i) => s + parseFloat(i.grossWeightKg ?? '0') * boxCount(i), 0)
  const totalNW  = distinctBoxes.reduce((s, i) => s + parseFloat(i.netWeightKg ?? '0') * boxCount(i), 0)
  const totalFt3 = distinctBoxes.reduce((s, i) => s + parseFloat(i.cubicFt ?? '0') * boxCount(i), 0)
  const totalCbm = distinctBoxes.reduce((s, i) => s + parseFloat(i.cbm ?? '0') * boxCount(i), 0)
  const rangeLabel = minBox != null && maxBox != null
    ? minBox === maxBox ? String(minBox) : `${minBox}–${maxBox}`
    : '-'
  // PI amount: sum unitPrice × qty per item
  const totalAmount = items.reduce((s, i) => {
    if (!i.unitPrice) return s
    return s + parseFloat(i.unitPrice) * i.quantity
  }, 0)
  return { totalQty, totalCartons, rangeLabel, totalGW, totalNW, totalFt3, totalCbm, totalAmount }
}

// ─── PL Tab ─────────────────────────────────────────────────────────────────

function PLTable({ groups, volUnit, setVolUnit }: {
  groups: ShipmentGroupData[]
  volUnit: 'ft3' | 'm3'
  setVolUnit: (v: 'ft3' | 'm3') => void
}) {
  const allItems = groups.flatMap(g => g.items)
  const multiGroup = groups.length > 1

  let grandGW = 0, grandNW = 0, grandFt3 = 0, grandCbm = 0, grandCartons = 0
  for (const group of groups) {
    const s = groupSummary(group.items)
    grandGW += s.totalGW; grandNW += s.totalNW
    grandFt3 += s.totalFt3; grandCbm += s.totalCbm
    grandCartons += s.totalCartons ?? 0
  }

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
        onClick={() => setVolUnit(volUnit === 'ft3' ? 'm3' : 'ft3')}
        className="text-[10px] bg-gray-200 hover:bg-gray-300 rounded px-1.5 py-0.5 font-mono text-gray-500 leading-none"
      >
        {volUnit === 'ft3' ? 'ft³' : 'm³'}
      </button>
    </div>
  )

  const volCell = (item: ShipmentItemData) =>
    volUnit === 'ft3'
      ? (item.cubicFt ? parseFloat(item.cubicFt).toFixed(3).replace(/\.?0+$/, '') : '-')
      : (item.cbm ? parseFloat(item.cbm).toFixed(4).replace(/\.?0+$/, '') : '-')

  const volGrpTotal = (s: ReturnType<typeof groupSummary>) =>
    volUnit === 'ft3' ? fmtNum(s.totalFt3) : fmtNum(s.totalCbm, 4)

  const volGrandTotal = volUnit === 'ft3' ? fmtNum(grandFt3) : fmtNum(grandCbm, 4)

  let rowNo = 0

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[780px]">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-center px-3 py-2 font-medium text-gray-500 w-10">No.</th>
            <th className="text-center px-3 py-2 font-medium text-gray-600 w-20">箱號</th>
            <th className="text-left   px-4 py-2 font-medium text-gray-600">品名 / SKU</th>
            <th className="text-right  px-3 py-2 font-medium text-gray-600 w-28">數量</th>
            <th className="text-right  px-3 py-2 font-medium text-gray-600 w-20">淨重 (kg)</th>
            <th className="text-right  px-3 py-2 font-medium text-gray-600 w-20">毛重 (kg)</th>
            <th className="text-right  px-3 py-2 font-medium text-gray-600 w-24">{volHeader}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group, gi) => {
            const s = groupSummary(group.items)
            return (
              <>
                {multiGroup && (
                  <tr key={`plpi-${gi}`} className="border-t-2 border-teal-200 bg-teal-50">
                    <td />
                    <td className="px-3 py-1.5 text-xs text-teal-600 font-mono">{s.rangeLabel}</td>
                    <td className="px-4 py-1.5 text-xs font-bold text-teal-700 font-mono">{group.label}</td>
                    <td className="px-3 py-1.5 text-right text-xs font-semibold text-teal-800">
                      {s.totalQty.toLocaleString()}
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs font-semibold text-teal-800">{fmtNum(s.totalNW)}</td>
                    <td className="px-3 py-1.5 text-right text-xs font-semibold text-teal-800">{fmtNum(s.totalGW)}</td>
                    <td className="px-3 py-1.5 text-right text-xs font-semibold text-teal-800">{volGrpTotal(s)}</td>
                  </tr>
                )}
                {group.items.map(item => {
                  rowNo++
                  return (
                    <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-center text-xs text-gray-400 font-mono">{rowNo}</td>
                      <td className="px-3 py-2 text-center text-xs text-gray-500 font-mono">{cartonLabel(item)}</td>
                      <td className="px-4 py-2">
                        <div className="text-gray-700 text-xs">{item.productName ?? '-'}</div>
                        <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                          {item.sku ?? ''}
                          {!item.hasLinkedOrder && item.hasRawSku && (
                            <span className="ml-1 text-amber-500" title="此 SKU 尚未連結至銷售品項">⚠</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {item.quantity.toLocaleString()}
                        {item.unit && <span className="ml-1 text-xs text-gray-400">{item.unit}</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-500">
                        {item.netWeightKg ? parseFloat(item.netWeightKg).toFixed(2) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-500">
                        {item.grossWeightKg ? parseFloat(item.grossWeightKg).toFixed(2) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-mono text-gray-500">{volCell(item)}</td>
                    </tr>
                  )
                })}
              </>
            )
          })}
          {/* Total */}
          <tr className="bg-gray-800 border-t-2 border-gray-600">
            <td colSpan={3} className="px-4 py-3 text-sm font-bold text-white">
              TOTAL &nbsp;
              <span className="text-xs font-normal text-gray-300">
                {grandCartons > 0 ? `${grandCartons} CTNS` : ''}
              </span>
            </td>
            <td className="px-3 py-3 text-right text-xs text-gray-300">
              {unitEntries.map(([u, q]) => `${q.toLocaleString()} ${u}`).join(' / ')}
            </td>
            <td className="px-3 py-3 text-right font-bold text-white">{fmtNum(grandNW)}</td>
            <td className="px-3 py-3 text-right font-bold text-white">{fmtNum(grandGW)}</td>
            <td className="px-3 py-3 text-right font-bold text-white">{volGrandTotal}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── CI Tab ──────────────────────────────────────────────────────────────────

function CITable({ groups, currency }: {
  groups: ShipmentGroupData[]
  currency: string | null
}) {
  const multiGroup = groups.length > 1
  const cur = currency ?? ''

  let grandTotal = 0
  for (const group of groups) {
    for (const item of group.items) {
      if (item.unitPrice) grandTotal += parseFloat(item.unitPrice) * item.quantity
    }
  }

  let rowNo = 0

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[620px]">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-center px-3 py-2 font-medium text-gray-500 w-10">No.</th>
            <th className="text-left   px-4 py-2 font-medium text-gray-600">品名 / SKU</th>
            <th className="text-right  px-3 py-2 font-medium text-gray-600 w-28">數量</th>
            <th className="text-right  px-3 py-2 font-medium text-gray-600 w-28">
              單價{cur && <span className="text-gray-400 font-normal ml-1">({cur})</span>}
            </th>
            <th className="text-right  px-4 py-2 font-medium text-gray-600 w-32">
              金額{cur && <span className="text-gray-400 font-normal ml-1">({cur})</span>}
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group, gi) => {
            const s = groupSummary(group.items)
            const piAmtLabel = group.piTotalAmount ? fmtMoney(group.piTotalAmount) : null
            // Fallback: sum from items if PI total not stored
            const computedAmt = s.totalAmount > 0
              ? s.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : null
            const amtLabel = piAmtLabel ?? computedAmt

            return (
              <>
                {multiGroup && (
                  <tr key={`cipi-${gi}`} className="border-t-2 border-teal-200 bg-teal-50">
                    <td />
                    <td className="px-4 py-1.5 text-xs font-bold text-teal-700 font-mono">{group.label}</td>
                    <td className="px-3 py-1.5 text-right text-xs font-semibold text-teal-800">
                      {s.totalQty.toLocaleString()}
                    </td>
                    <td />
                    <td className="px-4 py-1.5 text-right text-xs font-semibold text-teal-800 whitespace-nowrap">
                      {amtLabel ?? '-'}
                    </td>
                  </tr>
                )}
                {group.items.map(item => {
                  rowNo++
                  const amt = item.unitPrice
                    ? (parseFloat(item.unitPrice) * item.quantity)
                        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : null
                  return (
                    <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-center text-xs text-gray-400 font-mono">{rowNo}</td>
                      <td className="px-4 py-2">
                        <div className="text-gray-700 text-xs">{item.productName ?? '-'}</div>
                        <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                          {item.sku ?? ''}
                          {!item.hasLinkedOrder && item.hasRawSku && (
                            <span className="ml-1 text-amber-500" title="此 SKU 尚未連結至銷售品項">⚠</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {item.quantity.toLocaleString()}
                        {item.unit && <span className="ml-1 text-xs text-gray-400">{item.unit}</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-mono text-gray-500">
                        {item.unitPrice
                          ? parseFloat(item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                          : '-'}
                      </td>
                      <td className="px-4 py-2 text-right text-xs font-mono text-gray-700">
                        {amt ?? '-'}
                      </td>
                    </tr>
                  )
                })}
              </>
            )
          })}
          {/* GOODS TOTAL */}
          <tr className="border-t-2 border-gray-300 bg-gray-50">
            <td colSpan={4} className="px-4 py-2 text-xs text-gray-500 text-right font-medium">GOODS TOTAL</td>
            <td className="px-4 py-2 text-right text-sm font-semibold text-gray-800">
              {grandTotal > 0
                ? grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '-'}
            </td>
          </tr>
          {/* placeholder for surcharges — future: handling fee, freight */}
          <tr className="bg-gray-800 border-t-2 border-gray-600">
            <td colSpan={4} className="px-4 py-3 text-sm font-bold text-white text-right">TOTAL</td>
            <td className="px-4 py-3 text-right font-bold text-white">
              {grandTotal > 0
                ? grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '-'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ShipmentItemTable({ groups, shipmentCurrencyCode }: Props) {
  const [tab, setTab] = useState<'pl' | 'ci'>('pl')
  const [volUnit, setVolUnit] = useState<'ft3' | 'm3'>('ft3')

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => setTab('pl')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'pl'
              ? 'border-teal-500 text-teal-700 bg-white'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          裝箱單 <span className="text-xs font-normal ml-1 text-gray-400">Packing List</span>
        </button>
        <button
          onClick={() => setTab('ci')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'ci'
              ? 'border-teal-500 text-teal-700 bg-white'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          商業發票 <span className="text-xs font-normal ml-1 text-gray-400">Commercial Invoice</span>
        </button>
      </div>

      {tab === 'pl'
        ? <PLTable groups={groups} volUnit={volUnit} setVolUnit={setVolUnit} />
        : <CITable groups={groups} currency={shipmentCurrencyCode} />
      }
    </div>
  )
}
