import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Taipei',
  }).format(new Date(date))
}

/**
 * 以台北時區取得 YYYY-MM-DD。
 * 伺服器（Vercel）跑 UTC，直接 toISOString() 會在台灣 00:00–08:00 之間
 * 得到前一天的日期——所有給人看的日期與單號都必須用這個。
 */
export function taipeiDateISO(date: Date | string = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date))
}

/** 以台北時區取得 YYYYMMDD（單號日期段用） */
export function taipeiDateCompact(date: Date | string = new Date()): string {
  return taipeiDateISO(date).replace(/-/g, '')
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency = 'USD',
): string {
  if (amount == null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number(amount))
}

export function generatePoNo(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `PO-${y}${m}${d}-${rand}`
}
