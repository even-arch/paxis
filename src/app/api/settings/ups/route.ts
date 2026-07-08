import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const prisma = await getRequestPrisma()

  const [modeRow, ownAccountRow, legacyAccountRow, ownMultiplierRow, legacyMultiplierRow] = await Promise.all([
    prisma.sYS_KeyValue.findUnique({ where: { key: 'ups_mode' } }).catch(() => null),
    prisma.sYS_KeyValue.findUnique({ where: { key: 'ups_own_account_no' } }).catch(() => null),
    prisma.sYS_KeyValue.findUnique({ where: { key: 'ups_xinosys_account_no' } }).catch(() => null),
    prisma.sYS_KeyValue.findUnique({ where: { key: 'ups_own_discount_multiplier' } }).catch(() => null),
    prisma.sYS_KeyValue.findUnique({ where: { key: 'ups_discount_multiplier' } }).catch(() => null),
  ])

  // 向後相容：舊版 key ups_xinosys_account_no 被視為自有帳號
  const effectiveAccountNo = ownAccountRow?.value ?? legacyAccountRow?.value ?? ''
  const effectiveMultiplier = ownMultiplierRow?.value ?? legacyMultiplierRow?.value ?? null

  return NextResponse.json({
    upsMode: modeRow?.value ?? 'disabled',
    ownAccountNo: effectiveAccountNo,
    ownDiscountMultiplier: effectiveMultiplier ? parseFloat(effectiveMultiplier) : null,
  })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ownAccountNo, ownDiscountMultiplier } = await req.json() as {
    ownAccountNo?: string
    ownDiscountMultiplier?: number | null
  }

  const prisma = await getRequestPrisma()

  const upsert = async (key: string, value: string) =>
    prisma.sYS_KeyValue.upsert({ where: { key }, create: { key, value }, update: { value } }).catch(() => null)

  if (ownAccountNo !== undefined) {
    await upsert('ups_own_account_no', ownAccountNo.trim())
  }

  if (ownDiscountMultiplier !== undefined) {
    await upsert('ups_own_discount_multiplier', ownDiscountMultiplier != null ? String(ownDiscountMultiplier) : '')
  }

  return NextResponse.json({ ok: true })
}
