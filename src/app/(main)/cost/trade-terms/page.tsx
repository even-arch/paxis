'use client'
import { useState } from 'react'
import Link from 'next/link'

// 交易條件說明
const TERM_DESC: Record<string, string> = {
  EXW: '工廠交貨，買方負擔所有費用',
  FOB: '出口港船上交貨，賣方負責到裝船',
  FOR: '內陸交貨（鐵路/卡車），賣方負責運到指定地點',
  CFR: 'FOB + 海運費，買方負責保險',
  CIF: 'FOB + 海運費 + 保險',
  DDP: '完稅後交貨，賣方負擔一切費用含關稅',
}

type FeeRow = { label: string; amount: string; note: string }

function emptyFees(): FeeRow[] {
  return [
    { label: '內陸拖車費（FOR→FOB）', amount: '', note: '工廠到出口港卡車費用' },
    { label: '上港服務費', amount: '', note: '港口操作費' },
    { label: '銀行手續費', amount: '', note: '信用狀或匯款手續費' },
    { label: '包裝費', amount: '', note: '出口包裝、標籤' },
    { label: '海運費 / 空運費', amount: '', note: '從出口港到目的地' },
    { label: '保險費', amount: '', note: '貨物保險' },
    { label: '目的地關稅', amount: '', note: '進口關稅 + 增值稅' },
    { label: '目的地報關費', amount: '', note: '目的地清關代理費' },
    { label: '目的地送貨（UPS/陸運）', amount: '', note: '最後一哩送達' },
    { label: '其他', amount: '', note: '' },
  ]
}

function fmt2(n: number) {
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function TradeTermsPage() {
  const [buyTerm, setBuyTerm] = useState('FOR')
  const [sellTerm, setSellTerm] = useState('FOB')
  const [basePrice, setBasePrice] = useState('')
  const [currency, setCurrency] = useState('TWD')
  const [fees, setFees] = useState<FeeRow[]>(emptyFees())

  function updateFee(idx: number, field: keyof FeeRow, value: string) {
    setFees(prev => prev.map((f, i) => i === idx ? { ...f, [field]: value } : f))
  }

  const base = parseFloat(basePrice) || 0
  const totalFees = fees.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0)
  const effectiveCost = base + totalFees
  const diffAmt = totalFees
  const diffPct = base > 0 ? (totalFees / base) * 100 : 0
  const activeFees = fees.filter(f => parseFloat(f.amount) > 0)

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-5">
        <Link href="/cost" className="text-sm text-gray-400 hover:text-gray-600">← 成本計算</Link>
        <h1 className="text-xl font-semibold mt-1">交易條件差異計算</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          比較不同貿易條件（Incoterms）之間的成本差異，估算「差異百分比」供報價參考。
        </p>
      </div>

      {/* 基本設定 */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">基本設定</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">向供應商進貨條件</label>
            <select value={buyTerm} onChange={e => setBuyTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              {Object.keys(TERM_DESC).map(t => <option key={t}>{t}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">{TERM_DESC[buyTerm]}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">向客戶報價條件</label>
            <select value={sellTerm} onChange={e => setSellTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              {Object.keys(TERM_DESC).map(t => <option key={t}>{t}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">{TERM_DESC[sellTerm]}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">基準進貨價格</label>
            <input type="number" value={basePrice} onChange={e => setBasePrice(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">幣別</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              {['TWD', 'USD', 'EUR', 'CNY'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {buyTerm === sellTerm && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-700">
            ⚠ 進貨與報價條件相同（{buyTerm}），差異為零，通常不需要試算。
          </div>
        )}
      </div>

      {/* 費用明細 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-5">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            費用明細
            <span className="ml-2 text-xs font-normal text-gray-400">
              （填入「{buyTerm}」→「{sellTerm}」之間需要多承擔的費用）
            </span>
          </h2>
          <button onClick={() => setFees(emptyFees())}
            className="text-xs text-gray-400 hover:text-gray-600">重設</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">費用項目</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 w-36">金額（{currency}）</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 w-48">備註</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {fees.map((f, i) => (
              <tr key={i} className={parseFloat(f.amount) > 0 ? 'bg-blue-50/30' : ''}>
                <td className="px-4 py-2">
                  <input type="text" value={f.label} onChange={e => updateFee(i, 'label', e.target.value)}
                    className="w-full text-sm text-gray-700 bg-transparent border-0 focus:outline-none focus:bg-white focus:border focus:border-gray-200 focus:rounded px-1 py-0.5" />
                </td>
                <td className="px-4 py-2">
                  <input type="number" value={f.amount} onChange={e => updateFee(i, 'amount', e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded px-2 py-1 text-right text-sm font-mono focus:outline-none focus:border-blue-400" />
                </td>
                <td className="px-4 py-2">
                  <input type="text" value={f.note} onChange={e => updateFee(i, 'note', e.target.value)}
                    placeholder="說明…"
                    className="w-full text-xs text-gray-400 bg-transparent border-0 focus:outline-none focus:bg-white focus:border focus:border-gray-200 focus:rounded px-1 py-0.5" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50">
            <tr>
              <td className="px-4 py-3 font-medium text-gray-700">合計追加費用</td>
              <td className="px-4 py-3 text-right font-mono font-semibold">
                {fmt2(totalFees)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 結果 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">差異分析結果</h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">{buyTerm} 進貨價</p>
              <p className="text-lg font-bold font-mono text-gray-800">
                {base > 0 ? fmt2(base) : '—'}
              </p>
              <p className="text-xs text-gray-400">{currency}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 text-center border border-amber-100">
              <p className="text-xs text-amber-600 mb-1">追加費用（{buyTerm}→{sellTerm}）</p>
              <p className="text-lg font-bold font-mono text-amber-700">
                {totalFees > 0 ? `+ ${fmt2(totalFees)}` : '—'}
              </p>
              <p className="text-xs text-amber-500">{currency}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
              <p className="text-xs text-blue-600 mb-1">{sellTerm} 報價成本</p>
              <p className="text-lg font-bold font-mono text-blue-800">
                {effectiveCost > 0 ? fmt2(effectiveCost) : '—'}
              </p>
              <p className="text-xs text-blue-500">{currency}</p>
            </div>
          </div>

          {/* 差異百分比 — 主要數字 */}
          <div className={`rounded-xl p-5 text-center ${diffPct > 0 ? 'bg-gradient-to-r from-blue-600 to-blue-700' : 'bg-gray-100'}`}>
            <p className={`text-sm mb-1 ${diffPct > 0 ? 'text-blue-100' : 'text-gray-500'}`}>
              交易條件差異百分比（{buyTerm} → {sellTerm}）
            </p>
            <p className={`text-5xl font-bold tracking-tight ${diffPct > 0 ? 'text-white' : 'text-gray-400'}`}>
              {diffPct > 0 ? `+${diffPct.toFixed(2)}%` : '0%'}
            </p>
            {diffPct > 0 && base > 0 && (
              <p className="text-blue-200 text-sm mt-2">
                每單位 {currency} {fmt2(base)} 的 {buyTerm} 報價，{sellTerm} 成本約 {currency} {fmt2(effectiveCost)}
              </p>
            )}
            {diffPct === 0 && (
              <p className="text-gray-400 text-sm mt-1">請填入基準價格與費用明細</p>
            )}
          </div>

          {/* 有效費用項目列表 */}
          {activeFees.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 font-medium mb-2">包含費用項目：</p>
              <div className="flex flex-wrap gap-2">
                {activeFees.map((f, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                    {f.label}
                    <span className="ml-1 font-mono text-gray-400">
                      {fmt2(parseFloat(f.amount))}
                    </span>
                    <span className="ml-0.5 text-gray-400 text-xs">
                      ({base > 0 ? ((parseFloat(f.amount) / base) * 100).toFixed(1) : '—'}%)
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              ⚠ 此計算僅供內部報價參考，實際費用依每筆交易之重量、材積、目的地、承運商報價為準。差異百分比可做為對客戶報 {sellTerm} 時，在 {buyTerm} 採購價基礎上需加計的成本估算。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
