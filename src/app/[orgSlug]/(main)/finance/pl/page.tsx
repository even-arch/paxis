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
          collectedTWD: true,
          fxGainLoss: true,
          status: true,
        },
      },
      payables: {
        select: {
          amountTWD: true,
          paidAmountTWD: true,
          status: true,
          po: {
            select: {
              poNo: true,
              totalAmount: true,
              exchangeRate: true,
              currencyCode: true,
            },
          },
          supplier: { select: { shortName: true, name: true } },
        },
      },
    },
    orderBy: { actualShipDate: 'desc' },
  })

  const byMonth: Record<string, { revenue: number; cost: number; count: number }> = {}
  let totalRevenue = 0, totalCost = 0, totalFxGain = 0

  const rows = shipments.map(s => {
    const revenue = Number(s.receivable?.amountTWD ?? 0)
    const cost = s.payables.reduce((sum, p) => {
      const poAmt = p.po?.totalAmount
        ? Number(p.po.totalAmount) * Number(p.po.exchangeRate ?? 1)
        : null
      return sum + (poAmt ?? Number(p.amountTWD))
    }, 0)
    const grossProfit = revenue > 0 ? revenue - cost : null
    const margin = grossProfit != null && revenue > 0 ? (grossProfit / revenue) * 100 : null
    const fxGain = Number(s.receivable?.fxGainLoss ?? 0)
    const hasAR = !!s.receivable

    // 付款狀態計算
    const arCollected = s.receivable?.status === 2 || Number(s.receivable?.collectedTWD ?? 0) > 0
    const apPaid = s.payables.reduce((sum, p) => sum + Number(p.paidAmountTWD ?? 0), 0)
    const apUnpaid = Math.max(0, cost - apPaid)
    const apFullyPaid = s.payables.length > 0 && s.payables.every(p => p.status === 2)

    // 付款優先狀態
    // 'ready'   = AR 已收，AP 還有未付 → 可以立刻付供應商
    // 'waiting' = AR 未收，AP 還有未付 → 等客戶付
    // 'paid'    = AP 全部付清
    // 'no-ar'   = 沒有 AR 記錄
    const payStatus: 'ready' | 'waiting' | 'paid' | 'no-ar' =
      !hasAR ? 'no-ar'
      : apFullyPaid ? 'paid'
      : arCollected ? 'ready'
      : 'waiting'

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

    return { s, revenue, cost, grossProfit, margin, fxGain, hasAR, arCollected, apPaid, apUnpaid, apFullyPaid, payStatus }
  })

  const totalGrossProfit = totalRevenue - totalCost
  const totalMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0

  // 可立即付款的匯總
  const readyRows = rows.filter(r => r.payStatus === 'ready')
  const readyTotal = readyRows.reduce((s, r) => s + r.apUnpaid, 0)

  const fmt = (n: number) => n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
  const fmtPct = (n: number) => `${n.toFixed(1)}%`
  const fmtDate = (d: Date | null) => d ? new Date(d).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'

  // 排序：ready → waiting → paid / no-ar，相同狀態內按出貨日降冪
  const sortOrder = { ready: 0, waiting: 1, paid: 2, 'no-ar': 3 }
  const sortedRows = [...rows].sort((a, b) => sortOrder[a.payStatus] - sortOrder[b.payStatus])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">損益 & 付款狀態</h1>
          <p className="text-sm text-gray-500 mt-1">以出貨單為單位，對齊 AR 收款與 AP 付款進度</p>
        </div>
        <Link href={orgPath(params.orgSlug, '/finance')} className="text-sm text-blue-600 hover:underline">← 返回對帳付款</Link>
      </div>

      {/* 可立即付款提示 */}
      {readyRows.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-5 py-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-green-800">
              {readyRows.length} 筆出貨款已收，可立即付供應商
            </p>
            <p className="text-xs text-green-600 mt-0.5">
              {readyRows.map(r => r.s.shipmentNo).join('、')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-green-800">TWD {fmt(readyTotal)}</p>
            <p className="text-xs text-green-600">待付總額</p>
          </div>
        </div>
      )}

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
          <p className="text-xs text-gray-400 mt-0.5">依付款優先順序排列：可付 → 等收款 → 已付</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">出貨單</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">出貨日</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">客戶</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">收入 TWD</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">成本 TWD</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">毛利率</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">匯差</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">AR 收款</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">AP 待付</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">付款狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedRows.map(({ s, revenue, cost, margin, fxGain, hasAR, apUnpaid, payStatus }) => {
                const rowBg =
                  payStatus === 'ready' ? 'bg-green-50' :
                  payStatus === 'waiting' ? 'bg-amber-50' :
                  !hasAR ? 'bg-yellow-50' : 'hover:bg-gray-50'
                return (
                  <tr key={s.id} className={rowBg}>
                    <td className="px-4 py-3">
                      <Link href={orgPath(params.orgSlug, `/shipments/${s.id}`)}
                        className="font-mono text-blue-600 hover:underline text-xs">
                        {s.shipmentNo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(s.actualShipDate)}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs">{s.customer?.shortName ?? s.customer?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {hasAR ? fmt(revenue) : <span className="text-amber-500">待建 AR</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">{fmt(cost)}</td>
                    <td className={`px-4 py-3 text-right text-xs font-medium ${margin == null ? 'text-gray-300' : margin >= 20 ? 'text-green-600' : margin >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                      {margin == null ? '—' : fmtPct(margin)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono text-xs ${fxGain > 0 ? 'text-green-600' : fxGain < 0 ? 'text-red-500' : 'text-gray-300'}`}>
                      {fxGain !== 0 ? (fxGain > 0 ? '+' : '') + fmt(fxGain) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {!hasAR ? (
                        <span className="text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">缺 AR</span>
                      ) : s.receivable?.status === 2 ? (
                        <span className="text-green-700 bg-green-100 px-1.5 py-0.5 rounded">已收款</span>
                      ) : Number(s.receivable?.collectedTWD ?? 0) > 0 ? (
                        <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">部分收款</span>
                      ) : (
                        <span className="text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">未收款</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {apUnpaid > 0 ? (
                        <span className={payStatus === 'ready' ? 'text-green-700 font-semibold' : 'text-gray-600'}>
                          {fmt(apUnpaid)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {payStatus === 'ready' && (
                        <span className="text-green-700 bg-green-100 px-1.5 py-0.5 rounded font-medium">可付款</span>
                      )}
                      {payStatus === 'waiting' && (
                        <span className="text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">等收款</span>
                      )}
                      {payStatus === 'paid' && (
                        <span className="text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">AP 已付</span>
                      )}
                      {payStatus === 'no-ar' && (
                        <span className="text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded">缺 AR</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalFxGain !== 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
            累計匯差：
            <span className={`font-medium ml-1 ${totalFxGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalFxGain >= 0 ? '+' : ''}{fmt(totalFxGain)}
            </span>
            （押匯匯率 vs 開票匯率之差）
          </div>
        )}
      </div>
    </div>
  )
}
