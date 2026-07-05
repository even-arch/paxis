const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAPDuplication() {
  try {
    console.log('\n💰 應付帳款（AP）重複檢查\n');

    // 那三張出貨單
    const shipments = ['S250624', 'S250909', 'S251223'];

    for (const shipmentNo of shipments) {
      const shipment = await prisma.sLS.findFirst({
        where: { shipmentNo },
      });

      if (!shipment) {
        console.log(`❌ 未找到出貨單：${shipmentNo}`);
        continue;
      }

      const aps = await prisma.fIN_Payable.findMany({
        where: { shipmentId: shipment.id },
      });

      console.log(`\n📦 出貨單：${shipmentNo}`);
      console.log(`   應付帳款筆數：${aps.length}`);

      if (aps.length > 1) {
        console.log(`   ⚠️  發現 ${aps.length} 筆重複應付帳款！`);
        for (const ap of aps) {
          console.log(`      ID=${ap.id}, 金額=${ap.amountTWD}, receiptId=${ap.receiptId}, poId=${ap.poId}`);
        }
      }
    }

    // 統計所有應付帳款
    console.log('\n\n📊 全體應付帳款統計：');
    const totalAP = await prisma.fIN_Payable.count();
    const totalShipments = await prisma.sLS.count();
    
    const apsWithShipment = await prisma.fIN_Payable.findMany({
      where: { shipmentId: { not: null } },
      select: { shipmentId: true },
    });

    const shipmentIds = new Set(apsWithShipment.map(ap => ap.shipmentId));

    console.log(`   • 總應付帳款：${totalAP} 筆`);
    console.log(`   • 有應付帳款的出貨單：${shipmentIds.size} 個`);
    console.log(`   • 總出貨單：${totalShipments} 個`);

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
        if (!group.shipmentId) continue;
        const sls = await prisma.sLS.findUnique({
          where: { id: group.shipmentId },
          select: { shipmentNo: true },
        });
        console.log(`   • ${sls?.shipmentNo || '未知'}：${group._count.id} 筆`);
      }
    } else {
      console.log(`\n✅ 無重複應付帳款`);
    }

  } catch (err) {
    console.error('❌ 錯誤:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAPDuplication();
