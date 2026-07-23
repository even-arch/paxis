'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

/** 任何地方處理完告警（標記已處理、重新偵測、略過財務異常…）後
 *  dispatch 這個事件，紅點會立刻重新抓一次，不用等下個輪詢週期。 */
export const ALERTS_CHANGED_EVENT = 'paxis:alerts-changed'

/**
 * 側邊欄「資料警示」旁的數字紅點，取代原本頂部鈴鐺的即時提示功能。
 * 計入：未解決的資料品質告警 + 財務異常中的高優先（error）項目。
 *
 * 側邊欄跨頁面不會重新掛載，單靠輪詢會讓數字看起來「不即時」——
 * 改為：切換頁面時重抓一次 + 縮短輪詢間隔 + 監聽 ALERTS_CHANGED_EVENT
 * 讓處理告警的動作可以立刻反映在紅點上。
 */
export default function AlertsNavBadge() {
  const [count, setCount] = useState(0)
  const pathname = usePathname()

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
    window.addEventListener(ALERTS_CHANGED_EVENT, fetchCount)
    const timer = setInterval(fetchCount, 60 * 1000)
    return () => {
      cancelled = true
      window.removeEventListener(ALERTS_CHANGED_EVENT, fetchCount)
      clearInterval(timer)
    }
  }, [pathname]) // 每次換頁都重抓一次，處理完告警轉頁時能立刻更新

  if (count === 0) return null

  return (
    <span className="ml-auto flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-none bg-red-500 text-white">
      {count}
    </span>
  )
}
