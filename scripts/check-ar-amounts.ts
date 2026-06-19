import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const shipments = await prisma.sLS_Shipment.findMany({
    take: 5,
    orderBy: { actualShipDate: 'desc' },
    include: {
      pis: {
        include: {
          pi: {
            include: {
              order: {
                select: { id: true, orderNo: true, totalAmount: true, currencyCode: true, exchangeRate: true },
              },
              items: { select: { unitPrice: true, quantity: true } },
            },
            // piNo, totalAmount, currencyCode auto-selected via include
          },
        },
      },
      items: {
        include: {
          slsItem: { select: { unitPrice: true, quantity: true } },
        },
      },
    },
  })

  for (const s of shipments) {
    console.log(`\n=== Shipment: ${s.shipmentNo} | ciExRate: ${s.ciExchangeRate} ===`)
    for (const sp of s.pis) {
      const pi = sp.pi
      const piItemsTotal = pi.items.reduce((sum, i) => sum + Number(i.unitPrice ?? 0) * i.quantity, 0)
      console.log(`  PI: ${pi.piNo}`)
      console.log(`    Order.totalAmount: ${pi.order?.totalAmount ?? pi.totalAmount} (${pi.order?.currencyCode ?? pi.currencyCode}, rate=${pi.order?.exchangeRate ?? 1})`)
      console.log(`    PI items sum: ${piItemsTotal}`)
    }
    const shipItemsTotal = s.items.reduce((sum, i) => sum + Number(i.slsItem?.unitPrice ?? 0) * (i.quantity ?? 0), 0)
    console.log(`  SLS_ShipmentItem → slsItem prices total: ${shipItemsTotal}`)
    console.log(`  SLS_ShipmentItem count: ${s.items.length}`)
  }

  // 有多少 SLS_Order.totalAmount 是 null？
  const nullTotal = await prisma.sLS_Order.count({ where: { totalAmount: null } })
  const total = await prisma.sLS_Order.count()
  console.log(`\n=== SLS_Order totalAmount null: ${nullTotal} / ${total} ===`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
