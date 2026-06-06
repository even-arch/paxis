/**
 * 系統設定 key-value store（單租戶版）
 * 設定值存在 SYS_Company 的 JSON 欄位，或退回環境變數。
 * 暫時用 process.env fallback，之後可換成 DB-backed store。
 */

const envMap: Record<string, string | undefined> = {
  ups_xinosys_account_no: process.env.XINOSYS_UPS_ACCOUNT_NO,
  ups_discount_multiplier: process.env.UPS_DISCOUNT_MULTIPLIER,
  allow_tenant_delete: undefined,
}

const store: Record<string, string> = {}

export async function getSystemSetting(key: string): Promise<string | null> {
  if (key in store) return store[key] ?? null
  return envMap[key] ?? null
}

export async function setSystemSetting(key: string, value: string): Promise<void> {
  store[key] = value
}
