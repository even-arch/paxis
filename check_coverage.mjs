import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 各出貨單的 item 裡有多少 piId=null
const items = await prisma.sLS_ShipmentItem.findMany({
  select: { shipmentId: true, piId: true, slsItemId: true },
})
const shipments = await prisma.sLS_Shipment.findMany({
  select: { id: true, shipmentNo: true },
})

console.log('=== SLS_ShipmentItem piId/slsItemId 覆蓋率 ===')
for (const s of shipments) {
  const its = items.filter(i => i.shipmentId === s.id)
  const noPI = its.filter(i => !i.piId).length
  const noItem = its.filter(i => !i.slsItemId).length
  if (its.length > 0)
    console.log(`  ${s.shipmentNo}: ${its.length} items, piId=null: ${noPI}, slsItemId=null: ${noItem}`)
}

// SYS_PatiscoSync 狀態（只看 DO）
const syncs = await prisma.sYS_PatiscoSync.findMany({
  where: { docType: 'DO' },
  select: { patiscoDocNo: true, status: true, createdAt: true },
  orderBy: { createdAt: 'asc' },
})
console.log('\n=== SYS_PatiscoSync DO 狀態 ===')
syncs.forEach(r => console.log(`  ${r.patiscoDocNo}  status=${r.status}  at=${r.createdAt.toISOString().slice(0,10)}`))

await prisma.$disconnect()
