import { getSystemSetting } from './system-settings'

export async function getUpsAccountNo(): Promise<string> {
  const dbAccountNo = await getSystemSetting('ups_xinosys_account_no')
  const accountNo = dbAccountNo?.trim() || process.env.XINOSYS_UPS_ACCOUNT_NO
  if (!accountNo) {
    throw new Error('UPS 帳號未設定（請至 /admin/settings/ups 設定或設定環境變數 XINOSYS_UPS_ACCOUNT_NO）')
  }
  return accountNo
}

export function maskUpsAccountNo(accountNo: string): string {
  if (accountNo.length <= 3) return '***'
  return accountNo.slice(0, 2) + '*'.repeat(accountNo.length - 4) + accountNo.slice(-2)
}
