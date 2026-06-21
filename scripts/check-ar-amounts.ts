import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const shipments = await prisma.sLS.findMany({
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
    console.log(`  SLS_Item → slsItem prices total: ${shipItemsTotal}`)
    console.log(`  SLS_Item count: ${s.items.length}`)
  }

  // 有多少 PO_CustomerCopy.totalAmount 是 null？
  const nullTotal = await prisma.pO_CustomerCopy.count({ where: { totalAmount: null } })
  const total = await prisma.pO_CustomerCopy.count()
  console.log(`\n=== PO_CustomerCopy totalAmount null: ${nullTotal} / ${total} ===`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
