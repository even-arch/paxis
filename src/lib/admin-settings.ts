import { masterPrisma } from './master-db'

export async function getAdminSetting(key: string): Promise<string | null> {
  const row = await masterPrisma.aDMIN_Setting.findUnique({ where: { key } }).catch(() => null)
  return row?.value ?? null
}

export async function setAdminSetting(key: string, value: string): Promise<void> {
  await masterPrisma.aDMIN_Setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}
