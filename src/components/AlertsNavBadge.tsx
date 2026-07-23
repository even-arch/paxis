'use client'

import { useEffect, useState } from 'react'

/**
 * 側邊欄「資料警示」旁的數字紅點，取代原本頂部鈴鐺的即時提示功能。
 * 計入：未解決的資料品質告警 + 財務異常中的高優先（error）項目。
 */
export default function AlertsNavBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function fetchCount() {
      try {
        const [dataRes, finRes] = await Promise.all([
          fetch('/api/data-alerts'),
          fetch('/api/finance/alerts'),
        ])
        const data = await dataRes.json() as { alerts?: unknown[] }
        const fin = await finRes.json() as { alerts?: Array<{ level: string }> }
        const dataCount = data.alerts?.length ?? 0
        const finErrorCount = fin.alerts?.filter(a => a.level === 'error').length ?? 0
        if (!cancelled) setCount(dataCount + finErrorCount)
      } catch { /* 靜默失敗，不影響導覽列 */ }
    }

    fetchCount()
    const timer = setInterval(fetchCount, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  if (count === 0) return null

  return (
    <span className="ml-auto flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-none bg-red-500 text-white">
      {count}
    </span>
  )
}
