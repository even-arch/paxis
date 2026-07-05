const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAPDuplication() {
  try {
    console.log('\n💰 應付帳款（AP）重複檢查\n');

    // 檢查那三張出貨單的應付帳款
    const shipments = ['S250624', 'S250909', 'S251223'];

    for (const shipmentNo of shipments) {
      const shipment = await prisma.sLS.findFirst({
        where: { shipmentNo },
        include: {
          payable: true,
        },
      });

      if (!shipment) {
        console.log(`❌ 未找到出貨單：${shipmentNo}`);
        continue;
      }

      console.log(`\n📦 出貨單：${shipmentNo}`);
      console.log(`   應付帳款筆數：${shipment.payable.length}`);

      if (shipment.payable.length > 1) {
        console.log(`   ⚠️  發現 ${shipment.payable.length} 筆重複應付帳款！`);
        for (const ap of shipment.payable) {
          console.log(`      ID=${ap.id}, 金額=${ap.amountTWD}, 建立=${ap.createdAt.toISOString().slice(0, 19)}`);
        }
      }
    }

    // 統計所有應付帳款
    console.log('\n\n📊 全體應付帳款統計：');
    const totalAP = await prisma.fIN_Payable.count();
    const shipmentIds = new Set();
    
    const allAP = await prisma.fIN_Payable.findMany({
      select: { shipmentId: true },
    });

    allAP.forEach(ap => shipmentIds.add(ap.shipmentId));

    console.log(`   • 總應付帳款：${totalAP} 筆`);
    console.log(`   • 出貨單：${shipmentIds.size} 筆`);
    console.log(`   • 重複率：${totalAP > shipmentIds.size ? '✅ 有重複！' : '無重複'}`);

    // 找出重複最多的
    const apGroups = await prisma.fIN_Payable.groupBy({
      by: ['shipmentId'],
      having: {
        id: {
          _count: { gt: 1 },
        },
      },
      _count: { id: true },
    });

    if (apGroups.length > 0) {
      console.log(`\n❌ 發現 ${apGroups.length} 個出貨單有重複應付帳款：\n`);
      for (const group of apGroups) {
        const sls = await prisma.sLS.findUnique({
          where: { id: group.shipmentId },
          select: { shipmentNo: true },
        });
        console.log(`   • ${sls.shipmentNo}：${group._count.id} 筆`);
      }
    }

  } catch (err) {
    console.error('❌ 錯誤:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAPDuplication();
