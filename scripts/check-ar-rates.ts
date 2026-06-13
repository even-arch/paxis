import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // SLS_Order 的匯率和幣別
  const orders = await prisma.sLS_Order.findMany({
    select: { orderNo: true, currencyCode: true, totalAmount: true, exchangeRate: true },
    take: 10,
    orderBy: { createdAt: 'desc' },
  })
  console.log('SLS_Orders:')
  orders.forEach(o => console.log(`  ${o.orderNo}  ${o.currencyCode}  amount=${o.totalAmount}  rate=${o.exchangeRate}`))

  // FIN_Receivable 的狀況
  const recs = await prisma.fIN_Receivable.findMany({
    select: { currencyCode: true, amountForeign: true, rateAtInvoice: true, amountTWD: true },
    take: 5,
  })
  console.log('\nFIN_Receivable:')
  recs.forEach(r => console.log(`  ${r.currencyCode}  foreign=${r.amountForeign}  rate=${r.rateAtInvoice}  twd=${r.amountTWD}`))

  // SLS_Shipment ciExchangeRate
  const ships = await prisma.sLS_Shipment.findMany({
    select: { shipmentNo: true, ciExchangeRate: true, currencyCode: true },
    take: 5,
  })
  console.log('\nSLS_Shipment:')
  ships.forEach(s => console.log(`  ${s.shipmentNo}  currency=${s.currencyCode}  ciRate=${s.ciExchangeRate}`))
}

main().catch(console.error).finally(() => prisma.$disconnect())
