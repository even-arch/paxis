import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "PO_DeliveryNoteItem" CASCADE`)
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "PO_DeliveryNote" CASCADE`)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "SLS_DeliveryNote" (
      "id"            SERIAL PRIMARY KEY,
      "docNo"         TEXT NOT NULL UNIQUE,
      "customerId"    INTEGER REFERENCES "CUS_Customer"(id),
      "slsPiId"       INTEGER REFERENCES "PI"(id),
      "slsOrderId"    INTEGER REFERENCES "PO_CustomerCopy"(id),
      "issueDate"     TIMESTAMP(3) NOT NULL,
      "deliveryDate"  TIMESTAMP(3),
      "contactName"   TEXT,
      "contactPhone"  TEXT,
      "deliveryAddr"  TEXT,
      "freightCo"     TEXT,
      "vehicleNo"     TEXT,
      "shippingMark"  TEXT,
      "note"          TEXT,
      "counterpartNo" TEXT,
      "status"        TEXT NOT NULL DEFAULT 'DRAFT',
      "performedBy"   INTEGER REFERENCES "SYS_User"(id),
      "performedAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW(),
      "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT NOW(),
      "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT NOW()
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "SLS_DeliveryNoteItem" (
      "id"             SERIAL PRIMARY KEY,
      "deliveryNoteId" INTEGER NOT NULL REFERENCES "SLS_DeliveryNote"(id) ON DELETE CASCADE,
      "productId"      INTEGER REFERENCES "PRD_Product"(id),
      "description"    TEXT,
      "quantity"       INTEGER NOT NULL DEFAULT 0,
      "unit"           TEXT,
      "cartons"        INTEGER,
      "grossWeightKg"  DECIMAL
    )
  `)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_sls_dn_customer ON "SLS_DeliveryNote"("customerId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_sls_dn_pi ON "SLS_DeliveryNote"("slsPiId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_sls_dn_order ON "SLS_DeliveryNote"("slsOrderId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_sls_dni_dn ON "SLS_DeliveryNoteItem"("deliveryNoteId")`)
  console.log('OK')
}
main().catch(console.error).finally(() => prisma.$disconnect())
