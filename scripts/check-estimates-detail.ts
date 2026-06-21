import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // 1. 看所有 Shipment 的 ciExchangeRate 分佈
  const shipments = await prisma.sLS.findMany({
    orderBy: { actualShipDate: 'desc' },
    select: {
      id: true,
      shipmentNo: true,
      ciExchangeRate: true,
      receivable: { select: { id: true, currencyCode: true, amountForeign: true, amountTWD: true } },
      pis: {
        include: {
          pi: {
            include: {
              order: { select: { id: true, orderNo: true, totalAmount: true } },
            },
          },
        },
      },
    },
  })

  let totalAR = 0
  console.log('Shipment | ciExRate | OrderTotal sum | receivable')
  for (const s of shipments) {
    const orderSum = s.pis.reduce((sum, sp) => sum + Number(sp.pi.order?.totalAmount ?? sp.pi.totalAmount ?? 0), 0)
    const rec = s.receivable
    const recInfo = rec ? `REC(${rec.currencyCode} foreign=${rec.amountForeign} twd=${rec.amountTWD})` : 'no receivable'
    console.log(`${s.shipmentNo} | ${s.ciExchangeRate} | ${orderSum} | ${recInfo}`)
    totalAR += orderSum
  }
  console.log(`\nTotal AR (all shipments, order sum): ${totalAR}`)

  // 2. 看看有沒有重複的 order 被計算多次
  console.log('\n--- Checking duplicate orders in pis ---')
  for (const s of shipments.slice(0, 3)) {
    const orderIds = s.pis.map(sp => sp.pi.order?.id).filter(Boolean)
    const unique = new Set(orderIds)
    if (orderIds.length !== unique.size) {
      console.log(`${s.shipmentNo}: ${orderIds.length} pis but only ${unique.size} unique orders!`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
