import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PO_DeliveryNote" (
      "id" SERIAL PRIMARY KEY,
      "docNo" TEXT NOT NULL UNIQUE,
      "supplierId" INTEGER REFERENCES "SUP_Supplier"(id),
      "poOrderId" INTEGER REFERENCES "PO_Order"(id),
      "issueDate" TIMESTAMP(3) NOT NULL,
      "deliveryDate" TIMESTAMP(3),
      "contactName" TEXT,
      "contactPhone" TEXT,
      "deliveryAddr" TEXT,
      "freightCo" TEXT,
      "vehicleNo" TEXT,
      "shippingMark" TEXT,
      "note" TEXT,
      "counterpartNo" TEXT,
      "status" TEXT NOT NULL DEFAULT 'DRAFT',
      "performedBy" INTEGER REFERENCES "SYS_User"(id),
      "performedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PO_DeliveryNoteItem" (
      "id" SERIAL PRIMARY KEY,
      "deliveryNoteId" INTEGER NOT NULL REFERENCES "PO_DeliveryNote"(id) ON DELETE CASCADE,
      "productId" INTEGER REFERENCES "PRD_Product"(id),
      "description" TEXT,
      "quantity" INTEGER NOT NULL DEFAULT 0,
      "unit" TEXT,
      "cartons" INTEGER,
      "grossWeightKg" DECIMAL
    )
  `)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_dn_supplier ON "PO_DeliveryNote"("supplierId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_dn_po ON "PO_DeliveryNote"("poOrderId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_dni_dn ON "PO_DeliveryNoteItem"("deliveryNoteId")`)
  console.log('Tables created OK')
}
main().catch(console.error).finally(() => prisma.$disconnect())
