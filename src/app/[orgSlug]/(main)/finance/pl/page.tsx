export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { getPagePrisma } from '@/lib/page-db'
import { orgPath } from '@/lib/org-path'

export default async function PLPage({ params }: { params: { orgSlug: string } }) {
  const prisma = await getPagePrisma(params.orgSlug)

  const shipments = await prisma.sLS.findMany({
    include: {
      customer: { select: { name: true, shortName: true } },
      receivable: {
        select: {
          amountForeign: true,
          amountTWD: true,
          currencyCode: true,
          rateAtInvoice: true,
          rateAtCollection: true,
          collectedForeign: true,
          fxGainLoss: true,
          status: true,
        },
      },
      payables: {
        select: {
          amountTWD: true,
          po: { select: { poNo: true } },
          supplier: { select: { shortName: true, name: true } },
        },
      },
    },
    orderBy: { actualShipDate: 'desc' },
  })

  // 月份彙總
  const byMonth: Record<string, { revenue: number; cost: number; count: number }> = {}
  let totalRevenue = 0, totalCost = 0, totalFxGain = 0

  const rows = shipments.map(s => {
    const revenue = Number(s.receivable?.amountTWD ?? 0)
    const cost = s.payables.reduce((sum, p) => sum + Number(p.amountTWD), 0)
    const grossProfit = revenue > 0 ? revenue - cost : null
    const margin = grossProfit != null && revenue > 0 ? (grossProfit / revenue) * 100 : null
    const fxGain = Number(s.receivable?.fxGainLoss ?? 0)
    const hasAR = !!s.receivable

    if (hasAR && revenue > 0) {
      totalRevenue += revenue
      totalCost += cost
      totalFxGain += fxGain

      const month = s.actualShipDate
        ? new Date(s.actualShipDate).toISOString().slice(0, 7)
        : '未知'
      if (!byMonth[month]) byMonth[month] = { revenue: 0, cost: 0, count: 0 }
      byMonth[month].revenue += revenue
      byMonth[month].cost += cost
      byMonth[month].count++
    }

    return { s, revenue, cost, grossProfit, margin, fxGain, hasAR }
  })

  const totalGrossProfit = totalRevenue - totalCost
  const totalMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0

  const fmt = (n: number) => n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
  const fmtPct = (n: number) => `${n.toFixed(1)}%`
  const fmtDate = (d: Date | null) => d ? new Date(d).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">損益報表</h1>
          <p className="text-sm text-gray-500 mt-1">以出貨單為單位，計算每筆銷售的收入、成本與毛利</p>
        </div>
        <Link href={orgPath(params.orgSlug, '/finance')} className="text-sm text-blue-600 hover:underline">← 返回對帳付款</Link>
      </div>

      {/* 總計摘要 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-gray-500">總收入（TWD）</p>
          <p className="text-xl font-semibold text-gray-800 mt-1">{fmt(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-gray-500">總成本（TWD）</p>
          <p className="text-xl font-semibold text-gray-800 mt-1">{fmt(totalCost)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-gray-500">毛利（TWD）</p>
          <p className={`text-xl font-semibold mt-1 ${totalGrossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fmt(totalGrossProfit)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-gray-500">平均毛利率</p>
          <p className={`text-xl font-semibold mt-1 ${totalMargin >= 20 ? 'text-green-600' : totalMargin >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
            {fmtPct(totalMargin)}
          </p>
        </div>
      </div>

      {/* 月份彙總 */}
      {Object.keys(byMonth).length > 1 && (
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-700">月份彙總</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">月份</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">筆數</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">收入 (TWD)</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">成本 (TWD)</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">毛利 (TWD)</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">毛利率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([month, m]) => {
                  const gp = m.revenue - m.cost
                  const pct = m.revenue > 0 ? (gp / m.revenue) * 100 : 0
                  return (
                    <tr key={month} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-700">{month}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{m.count}</td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(m.revenue)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500">{fmt(m.cost)}</td>
                      <td className={`px-4 py-3 text-right font-mono font-medium ${gp >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(gp)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${pct >= 20 ? 'text-green-600' : pct >= 10 ? 'text-amber-600' : 'text-red-600'}`}>{fmtPct(pct)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 出貨單明細 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-700">出貨單明細</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">出貨單</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">出貨日</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">客戶</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">收入 EUR</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">收入 TWD</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">成本 TWD</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">毛利 TWD</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">毛利率</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">匯差</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">AR 狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(({ s, revenue, cost, grossProfit, margin, fxGain, hasAR }) => (
                <tr key={s.id} className={!hasAR ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-3">
                    <Link href={orgPath(params.orgSlug, `/shipments/${s.id}`)}
                      className="font-mono text-blue-600 hover:underline text-xs">
                      {s.shipmentNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(s.actualShipDate)}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{s.customer?.shortName ?? s.customer?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">
                    {s.receivable?.amountForeign ? Number(s.receivable.amountForeign).toLocaleString('de-DE', { maximumFractionDigits: 2 }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {hasAR ? fmt(revenue) : <span className="text-amber-500 text-xs">待建 AR</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">{fmt(cost)}</td>
                  <td className={`px-4 py-3 text-right font-mono text-xs font-medium ${grossProfit == null ? 'text-gray-300' : grossProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {grossProfit == null ? '—' : fmt(grossProfit)}
                  </td>
                  <td className={`px-4 py-3 text-right text-xs font-medium ${margin == null ? 'text-gray-300' : margin >= 20 ? 'text-green-600' : margin >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                    {margin == null ? '—' : fmtPct(margin)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono text-xs ${fxGain > 0 ? 'text-green-600' : fxGain < 0 ? 'text-red-500' : 'text-gray-300'}`}>
                    {fxGain !== 0 ? (fxGain > 0 ? '+' : '') + fmt(fxGain) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {!hasAR ? (
                      <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">缺 AR</span>
                    ) : s.receivable?.status === 2 ? (
                      <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">已收款</span>
                    ) : (
                      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">未收款</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 匯差說明 */}
        {totalFxGain !== 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
            累計匯差：
            <span className={`font-medium ml-1 ${totalFxGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalFxGain >= 0 ? '+' : ''}{fmt(totalFxGain)}
            </span>
            （押匯匯率 vs 開票匯率之差，含稅前）
          </div>
        )}
      </div>
    </div>
  )
}
