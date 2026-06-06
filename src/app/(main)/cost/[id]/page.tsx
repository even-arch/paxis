import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import DeleteCostButton from './DeleteCostButton'

type Props = { params: { id: string } }

export default async function CostDetailPage({
  params }: Props) {
    const sheet = await prisma.cOST_Sheet.findUnique({
    where: { id: Number(params.id) },
    include: {
      product: {
        select: {
          id: true, name: true, sku: true, modelNo: true, unit: true,
          unitPerInner: true, unitPerCarton: true, cbm: true,
          grossWeight: true, netWeight: true,
        },
      },
      creator: { select: { name: true } },
    },
  })

  if (!sheet) notFound()

  const n = (v: unknown) => v ? parseFloat(String(v)) : 0
  const fmt = (v: unknown, d = 4) => v ? parseFloat(String(v)).toFixed(d) : '-'
  const fmtUsd = (v: unknown) => v ? `USD ${parseFloat(String(v)).toFixed(4)}` : '-'

  const fobUsd = n(sheet.fobPrice) * n(sheet.fobExRate)
  const grossPct = sheet.grossMarginPct ? n(sheet.grossMarginPct) * 100 : null
  const grossColor = grossPct === null ? 'text-gray-500'
    : grossPct < 0 ? 'text-red-600' : grossPct < 20 ? 'text-yellow-600' : 'text-green-600'

  const otherTotal = [sheet.oceanFreight, sheet.insurance, sheet.agentFee,
    sheet.consolidation, sheet.deconsolidation, sheet.userFee, sheet.harborFee, sheet.otherCharge]
    .reduce((s, v) => s + n(v), 0)

  return (
    <div className="max-w-3xl">
      {/* 標題列 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <a href="/cost" className="text-sm text-gray-400 hover:text-gray-600">← 成本計算</a>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">{sheet.name}</h1>
          <p className="text-sm text-gray-500">
            商品：<a href={`/products/${sheet.product.id}`} className="text-blue-600 hover:underline">{sheet.product.name}</a>
            {sheet.product.sku && <span className="text-gray-400 ml-1">({sheet.product.sku})</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50 print:hidden">
            列印
          </button>
          <a href={`/cost/${params.id}/edit`}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50 print:hidden">
            編輯
          </a>
          <DeleteCostButton sheetId={params.id} />
        </div>
      </div>

      {/* 毛利率大字顯示 */}
      <div className={`bg-white rounded-lg shadow p-6 mb-4 flex items-center justify-between`}>
        <div>
          <p className="text-sm text-gray-500">到岸成本 Landed Cost</p>
          <p className="text-3xl font-bold text-gray-900">{fmtUsd(sheet.landedCost)}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">↓</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">建議售價 Selling Price</p>
          <p className="text-3xl font-bold text-gray-700">{sheet.sellingPrice ? `USD ${fmt(sheet.sellingPrice, 2)}` : '未設定'}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">毛利率 Gross %</p>
          <p className={`text-5xl font-bold ${grossColor}`}>
            {grossPct !== null ? `${grossPct.toFixed(1)}%` : '-'}
          </p>
          {grossPct !== null && sheet.landedCost && sheet.sellingPrice && (
            <p className="text-xs text-gray-400 mt-1">
              每件毛利 USD {(n(sheet.sellingPrice) - n(sheet.landedCost)).toFixed(4)}
            </p>
          )}
        </div>
      </div>

      {/* 成本明細表（ET61 風格） */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
        <div className="px-6 py-4 bg-gray-800 text-white">
          <h2 className="text-base font-semibold">到岸成本計算表</h2>
          <p className="text-xs text-gray-400">{sheet.product.name} ｜ {sheet.htsCode ?? 'HTS N/A'} ｜ {sheet.countryOfOrigin ?? '-'}</p>
        </div>
        <table className="w-full text-sm">
          <tbody>
            <Section label="FOB 成本" />
            <Row label={`FOB Price (${sheet.fobCurrency})`} value={fmt(sheet.fobPrice)} right />
            <Row label={`匯率 1 ${sheet.fobCurrency} = USD`} value={fmt(sheet.fobExRate, 6)} right />
            <Row label="FOB (USD)" value={`USD ${fobUsd.toFixed(4)}`} right bold />
            {sheet.portOfLoading && <Row label="裝運港" value={sheet.portOfLoading} />}

            <Section label="關稅 Duty" />
            <Row label="HTS Code" value={sheet.htsCode ?? '-'} />
            <Row label={`關稅率 (${sheet.dutyRate ? (n(sheet.dutyRate) * 100).toFixed(2) + '%)' : 'N/A)'}`}
              value={fmtUsd(sheet.dutyAmount)} right />

            <Section label="其他進口費用" />
            {[
              ['海運費 Ocean Freight', sheet.oceanFreight],
              ['保險費 Insurance', sheet.insurance],
              ['報關代理費 Agent Fee', sheet.agentFee],
              ['併櫃費 Consolidation', sheet.consolidation],
              ['拆櫃費 Deconsolidation', sheet.deconsolidation],
              ['User Fee (MPF)', sheet.userFee],
              ['Harbor Fee (HMF)', sheet.harborFee],
              [sheet.otherChargeNote || '其他雜費', sheet.otherCharge],
            ].filter(([, v]) => v && n(v) > 0).map(([label, val]) => (
              <Row key={String(label)} label={String(label)} value={fmtUsd(val)} right />
            ))}
            <Row label="其他費用小計" value={`USD ${otherTotal.toFixed(4)}`} right bold />

            <Section label="合計" highlight />
            <Row label="Landed Cost (USD)" value={fmtUsd(sheet.landedCost)} right bold big />
          </tbody>
        </table>
      </div>

      {/* 商品包裝資訊 */}
      {(sheet.product.unitPerCarton || sheet.product.cbm || sheet.container40ftQty) && (
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-base font-semibold text-gray-700 mb-3">包裝 &amp; 容器資訊</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <Info label="每內箱" value={sheet.product.unitPerInner ? `${sheet.product.unitPerInner} ${sheet.product.unit ?? 'PCS'}` : '-'} />
            <Info label="每外箱" value={sheet.product.unitPerCarton ? `${sheet.product.unitPerCarton} ${sheet.product.unit ?? 'PCS'}` : '-'} />
            <Info label="CBM" value={sheet.product.cbm ? `${fmt(sheet.product.cbm)} m³` : '-'} />
            <Info label="毛重" value={sheet.product.grossWeight ? `${fmt(sheet.product.grossWeight, 3)} KGS` : '-'} />
            <Info label="淨重" value={sheet.product.netWeight ? `${fmt(sheet.product.netWeight, 3)} KGS` : '-'} />
            <div />
            {sheet.container40ftQty && <Info label="40' 容器（箱）" value={`${sheet.container40ftQty} CTNS`} />}
            {sheet.container40ftPcs && <Info label="40' 容器（件）" value={`${sheet.container40ftPcs} ${sheet.product.unit ?? 'PCS'}`} />}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        建立者：{sheet.creator.name}｜建立：{formatDate(sheet.createdAt)}｜更新：{formatDate(sheet.updatedAt)}
      </p>
    </div>
  )
}

function Section({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <tr className={highlight ? 'bg-gray-800' : 'bg-gray-50'}>
      <td colSpan={2} className={`px-4 py-2 text-xs font-semibold tracking-wide ${highlight ? 'text-white' : 'text-gray-500'}`}>
        {label}
      </td>
    </tr>
  )
}

function Row({ label, value, right, bold, big }: {
  label: string; value: string; right?: boolean; bold?: boolean; big?: boolean
}) {
  return (
    <tr className="border-b border-gray-50">
      <td className="px-4 py-2 text-gray-600">{label}</td>
      <td className={`px-4 py-2 ${right ? 'text-right' : ''} ${bold ? 'font-semibold text-gray-800' : 'text-gray-600'} ${big ? 'text-lg' : ''} font-mono`}>
        {value}
      </td>
    </tr>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-medium text-gray-700">{value}</p>
    </div>
  )
}
