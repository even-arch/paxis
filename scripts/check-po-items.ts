import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // 有 PO_Item 的 PO
  const withItems = await prisma.pO.count({ where: { items: { some: {} } } })
  // 抽一筆有 items 的看看
  const sample = await prisma.pO.findFirst({
    where: { items: { some: {} } },
    include: {
      items: { select: { unitPrice: true, quantity: true } },
    },
  })
  // PO_CustomerCopy 有沒有對應 PO 同號的
  const matchCount = await prisma.pO.count({
    where: { poNo: { in: (await prisma.pO_CustomerCopy.findMany({ select: { orderNo: true } })).map(s => s.orderNo) } }
  })
  console.log({ poWithItems: withItems, matchByPoNo: matchCount })
  if (sample) {
    const total = sample.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0)
    console.log('Sample PO items total:', total, 'poNo:', sample.poNo, 'currency:', sample.currencyCode)
    console.log('Items:', sample.items.slice(0, 3))
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
