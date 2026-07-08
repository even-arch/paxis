import { getSystemSetting } from './system-settings'
import type { PrismaClient } from '@prisma/client'

export interface UpsCreds {
  accountNo: string
  discountMultiplier: number | null
  source: 'own' | 'managed'
}

/**
 * 解析該租戶應使用哪組 UPS 憑證：
 *  1. 租戶自有帳號（SYS_KeyValue: ups_own_account_no）
 *  2. 平台代管（SYS_KeyValue: ups_mode = 'managed'）→ 讀平台帳號
 *  3. 都沒有 → 回傳 null
 */
export async function resolveUpsCreds(tenantPrisma: PrismaClient): Promise<UpsCreds | null> {
  const [ownAccountRow, legacyAccountRow] = await Promise.all([
    tenantPrisma.sYS_KeyValue.findUnique({ where: { key: 'ups_own_account_no' } }).catch(() => null),
    // 舊版 key，pointasia 自己在遷移前繼續有效
    tenantPrisma.sYS_KeyValue.findUnique({ where: { key: 'ups_xinosys_account_no' } }).catch(() => null),
  ])
  const ownAccount = ownAccountRow?.value?.trim() || legacyAccountRow?.value?.trim()

  if (ownAccount) {
    const multiplierRow = await tenantPrisma.sYS_KeyValue.findUnique({ where: { key: 'ups_own_discount_multiplier' } }).catch(() => null)
    const legacyMultiplierRow = multiplierRow ?? await tenantPrisma.sYS_KeyValue.findUnique({ where: { key: 'ups_discount_multiplier' } }).catch(() => null)
    const multiplier = legacyMultiplierRow?.value ? parseFloat(legacyMultiplierRow.value) : null
    return { accountNo: ownAccount, discountMultiplier: multiplier, source: 'own' }
  }

  const modeRow = await tenantPrisma.sYS_KeyValue.findUnique({ where: { key: 'ups_mode' } }).catch(() => null)
  if (modeRow?.value === 'managed') {
    const platformAccount = await getSystemSetting('ups_xinosys_account_no')
    const accountNo = platformAccount?.trim() || process.env.XINOSYS_UPS_ACCOUNT_NO
    if (!accountNo) return null
    const multiplierStr = await getSystemSetting('ups_discount_multiplier')
    const discountMultiplier = multiplierStr ? parseFloat(multiplierStr) : null
    return { accountNo, discountMultiplier, source: 'managed' }
  }

  return null
}

export function maskUpsAccountNo(accountNo: string): string {
  if (accountNo.length <= 3) return '***'
  return accountNo.slice(0, 2) + '*'.repeat(accountNo.length - 4) + accountNo.slice(-2)
}
