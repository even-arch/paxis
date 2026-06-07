/**
 * 系統設定 key-value store（DB-backed，持久化）
 * 讀取順序：DB → 環境變數 fallback
 */

import { prisma } from './db'

const envFallback: Record<string, string | undefined> = {
  ups_xinosys_account_no: process.env.XINOSYS_UPS_ACCOUNT_NO,
  ups_discount_multiplier: process.env.UPS_DISCOUNT_MULTIPLIER,
}

/** 第一次儲存時自動建立 SYS_KeyValue 表（防止 migration 未跑的情況） */
export async function ensureKeyValueTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SYS_KeyValue" (
      "key"       TEXT PRIMARY KEY,
      "value"     TEXT NOT NULL DEFAULT '',
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    )
  `)
}

export async function getSystemSetting(key: string): Promise<string | null> {
  try {
    const row = await prisma.sYS_KeyValue.findUnique({ where: { key } })
    if (row?.value != null && row.value !== '') return row.value
  } catch {
    // 表不存在或 DB 不可用時 fallback 到環境變數
  }
  return envFallback[key] ?? null
}

export async function setSystemSetting(key: string, value: string): Promise<void> {
  await prisma.sYS_KeyValue.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}
