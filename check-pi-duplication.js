const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPIDuplication() {
  try {
    console.log('\n📋 PI 重複檢查\n');

    // 檢查重複的 PI（按 piNo 分組）
    const piGroups = await prisma.pI.groupBy({
      by: ['piNo'],
      having: {
        id: {
          _count: { gt: 1 },
        },
      },
    });

    console.log(`🔍 找到 ${piGroups.length} 個重複的 PI 號\n`);

    if (piGroups.length === 0) {
      console.log('✅ 無重複 PI');
      return;
    }

    // 顯示詳細的重複情況
    for (const group of piGroups.slice(0, 10)) {
      const pis = await prisma.pI.findMany({
        where: { piNo: group.piNo },
        select: {
          id: true,
          piNo: true,
          createdAt: true,
          status: true,
          customer: { select: { name: true } },
          order: { select: { orderNo: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      console.log(`\n📌 PI 號：${group.piNo}`);
      console.log(`   客戶：${pis[0].customer?.name || 'N/A'}`);
      console.log(`   訂單：${pis[0].order?.orderNo || 'N/A'}`);
      console.log(`   找到 ${pis.length} 筆重複記錄：`);

      for (let i = 0; i < pis.length; i++) {
        const marker = i === 0 ? '✅ 原' : '❌ 複';
        console.log(`      ${marker} ID=${pis[i].id}, 創建=${pis[i].createdAt.toISOString().slice(0, 19)}, 狀態=${pis[i].status}`);
      }
    }

    // 統計
    const totalPIs = await prisma.pI.count();
    const uniquePINumbers = await prisma.pI.findMany({
      distinct: ['piNo'],
      select: { piNo: true },
    });

    console.log(`\n\n📊 統計：`);
    console.log(`   • 總 PI 筆數：${totalPIs}`);
    console.log(`   • 唯一 PI 號：${uniquePINumbers.length}`);
    console.log(`   • 重複率：${(100 - (uniquePINumbers.length / totalPIs * 100)).toFixed(1)}%`);

  } catch (err) {
    console.error('❌ 錯誤:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkPIDuplication();
