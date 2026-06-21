import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const pos = await prisma.pO.findMany({
    select: { id: true, poNo: true, patiscoOrderNo: true, totalAmount: true, currencyCode: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  const sls = await prisma.pO_CustomerCopy.findMany({
    select: { id: true, orderNo: true, totalAmount: true, currencyCode: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  console.log('PO_Orders (latest 10):')
  pos.forEach(p => console.log(`  id=${p.id} poNo="${p.poNo}" patiscoOrderNo="${p.patiscoOrderNo}" amount=${p.totalAmount} ${p.currencyCode}`))
  console.log('\nSLS_Orders (latest 10):')
  sls.forEach(s => console.log(`  id=${s.id} orderNo="${s.orderNo}" amount=${s.totalAmount} ${s.currencyCode}`))
}

main().catch(console.error).finally(() => prisma.$disconnect())
