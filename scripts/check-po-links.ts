import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const totalPO = await prisma.pO.count()
  const linkedPO = await prisma.pO.count({ where: { salesOrderId: { not: null } } })

  const sample = await prisma.sLS_PI_Link.findFirst({
    include: {
      pi: {
        include: {
          order: {
            select: {
              orderNo: true,
              purchaseOrders: { select: { id: true, poNo: true } },
            },
          },
        },
      },
    },
  })

  const sampleOrderNo = sample?.pi.order?.orderNo
  const poByPatisco = sampleOrderNo
    ? await prisma.pO.findMany({
        where: { patiscoOrderNo: sampleOrderNo },
        select: { poNo: true, patiscoOrderNo: true },
      })
    : []

  console.log(JSON.stringify({
    totalPO,
    linkedPO,
    sampleOrderNo,
    linkedFromSalesOrder: sample?.pi.order?.purchaseOrders?.length,
    poByPatisco,
  }, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
