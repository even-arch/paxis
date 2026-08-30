/**
 * POST /api/admin/schema-sync
 *
 * 一次性手動補跑 DB schema 同步，補齊尚未 db:push 的欄位與資料表。
 * 所有操作皆使用 IF NOT EXISTS，安全可重複執行。
 *
 * 使用方式（在已登入的頁面開啟瀏覽器 Console）：
 *   fetch('/api/admin/schema-sync', { method: 'POST' }).then(r => r.json()).then(console.log)
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

async function exec(
  prisma: Awaited<ReturnType<typeof getRequestPrisma>>,
  label: string,
  sql: string,
): Promise<string> {
  try {
    await prisma.$executeRawUnsafe(sql)
    return `✓ ${label}`
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return `✗ ${label}: ${msg.slice(0, 120)}`
  }
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const prisma = await getRequestPrisma()
  const results: string[] = []

  // ── 1. New columns on existing tables ─────────────────────────────────────
  results.push(await exec(prisma, 'SUP_Supplier.commissionPct',
    `ALTER TABLE "SUP_Supplier" ADD COLUMN IF NOT EXISTS "commissionPct" DECIMAL(65,30)`))

  results.push(await exec(prisma, 'FIN_Payable.fobCostDeductionTWD',
    `ALTER TABLE "FIN_Payable" ADD COLUMN IF NOT EXISTS "fobCostDeductionTWD" DECIMAL(65,30) NOT NULL DEFAULT 0`))

  results.push(await exec(prisma, 'FIN_PaymentVoucher.supplierInvoiceNo',
    `ALTER TABLE "FIN_PaymentVoucher" ADD COLUMN IF NOT EXISTS "supplierInvoiceNo" TEXT`))

  // ── 2. New tables ──────────────────────────────────────────────────────────
  results.push(await exec(prisma, 'FIN_PaymentVoucher (table)',
    `CREATE TABLE IF NOT EXISTS "FIN_PaymentVoucher" (
      "id" SERIAL PRIMARY KEY,
      "voucherNo" TEXT NOT NULL,
      "supplierId" INTEGER NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'DRAFT',
      "vatPct" DECIMAL(65,30) NOT NULL DEFAULT 5,
      "note" TEXT,
      "supplierInvoiceNo" TEXT,
      "sentAt" TIMESTAMP(3),
      "confirmedAt" TIMESTAMP(3),
      "paidAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FIN_PaymentVoucher_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SUP_Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`))

  results.push(await exec(prisma, 'FIN_PaymentVoucher UNIQUE voucherNo',
    `CREATE UNIQUE INDEX IF NOT EXISTS "FIN_PaymentVoucher_voucherNo_key" ON "FIN_PaymentVoucher"("voucherNo")`))

  results.push(await exec(prisma, 'FIN_PaymentVoucher idx supplierId',
    `CREATE INDEX IF NOT EXISTS "FIN_PaymentVoucher_supplierId_idx" ON "FIN_PaymentVoucher"("supplierId")`))

  results.push(await exec(prisma, 'FIN_PaymentVoucher idx status',
    `CREATE INDEX IF NOT EXISTS "FIN_PaymentVoucher_status_idx" ON "FIN_PaymentVoucher"("status")`))

  results.push(await exec(prisma, 'FIN_PaymentVoucherItem (table)',
    `CREATE TABLE IF NOT EXISTS "FIN_PaymentVoucherItem" (
      "id" SERIAL PRIMARY KEY,
      "voucherId" INTEGER NOT NULL,
      "payableId" INTEGER NOT NULL,
      "amountTWD" DECIMAL(65,30) NOT NULL,
      CONSTRAINT "FIN_PaymentVoucherItem_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "FIN_PaymentVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FIN_PaymentVoucherItem_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "FIN_Payable"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "FIN_PaymentVoucherItem_payableId_key" UNIQUE ("payableId")
    )`))

  results.push(await exec(prisma, 'FIN_PaymentVoucherItem idx voucherId',
    `CREATE INDEX IF NOT EXISTS "FIN_PaymentVoucherItem_voucherId_idx" ON "FIN_PaymentVoucherItem"("voucherId")`))

  results.push(await exec(prisma, 'FIN_PaymentVoucherAdjustment (table)',
    `CREATE TABLE IF NOT EXISTS "FIN_PaymentVoucherAdjustment" (
      "id" SERIAL PRIMARY KEY,
      "voucherId" INTEGER NOT NULL,
      "name" TEXT NOT NULL,
      "amountTWD" DECIMAL(65,30) NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'OTHER',
      "note" TEXT,
      CONSTRAINT "FIN_PaymentVoucherAdjustment_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "FIN_PaymentVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`))

  results.push(await exec(prisma, 'FIN_PaymentVoucherAdjustment idx voucherId',
    `CREATE INDEX IF NOT EXISTS "FIN_PaymentVoucherAdjustment_voucherId_idx" ON "FIN_PaymentVoucherAdjustment"("voucherId")`))

  results.push(await exec(prisma, 'SLS_FobCostItem (table)',
    `CREATE TABLE IF NOT EXISTS "SLS_FobCostItem" (
      "id" SERIAL PRIMARY KEY,
      "shipmentId" INTEGER NOT NULL,
      "name" TEXT NOT NULL,
      "amountTWD" DECIMAL(65,30) NOT NULL,
      "note" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SLS_FobCostItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "SLS"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`))

  results.push(await exec(prisma, 'SLS_FobCostItem idx shipmentId',
    `CREATE INDEX IF NOT EXISTS "SLS_FobCostItem_shipmentId_idx" ON "SLS_FobCostItem"("shipmentId")`))

  results.push(await exec(prisma, 'SLS_FobCostAllocation (table)',
    `CREATE TABLE IF NOT EXISTS "SLS_FobCostAllocation" (
      "id" SERIAL PRIMARY KEY,
      "costItemId" INTEGER NOT NULL,
      "supplierId" INTEGER NOT NULL,
      "poId" INTEGER,
      "cbm" DECIMAL(65,30) NOT NULL,
      "cbmPct" DECIMAL(65,30) NOT NULL,
      "allocatedTWD" DECIMAL(65,30) NOT NULL,
      "applied" BOOLEAN NOT NULL DEFAULT false,
      "payableId" INTEGER,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SLS_FobCostAllocation_costItemId_fkey" FOREIGN KEY ("costItemId") REFERENCES "SLS_FobCostItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "SLS_FobCostAllocation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SUP_Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "SLS_FobCostAllocation_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "FIN_Payable"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`))

  results.push(await exec(prisma, 'SLS_FobCostAllocation idx costItemId',
    `CREATE INDEX IF NOT EXISTS "SLS_FobCostAllocation_costItemId_idx" ON "SLS_FobCostAllocation"("costItemId")`))

  results.push(await exec(prisma, 'SLS_FobCostAllocation idx supplierId',
    `CREATE INDEX IF NOT EXISTS "SLS_FobCostAllocation_supplierId_idx" ON "SLS_FobCostAllocation"("supplierId")`))

  const success = results.filter(r => r.startsWith('✓')).length
  const failed = results.filter(r => r.startsWith('✗')).length

  return NextResponse.json({ ok: true, success, failed, results })
}
