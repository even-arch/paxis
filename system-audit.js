const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function systemAudit() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 PAXIS 系統完整審查');
    console.log('='.repeat(80) + '\n');

    // 1. PI ↔ PO 對帳機制
    console.log('1️⃣  PI ↔ PO 對帳機制\n');

    const piCount = await prisma.pI.count();
    const poCount = await prisma.pO.count();
    
    const posWithSlsPiId = await prisma.pO.count({ where: { slsPiId: { not: null } } });
    
    console.log(`   PI 總數: ${piCount}`);
    console.log(`   PO 總數: ${poCount}`);
    console.log(`   PO 中有 slsPiId（FK 連結到 PI）的: ${posWithSlsPiId} 個\n`);

    // 2. Receipt 類型
    console.log('2️⃣  PO_Receipt 類型\n');

    const virtualReceiptCount = await prisma.pO_Receipt.count({ 
      where: { receiptNo: { startsWith: 'VIRTUAL' } } 
    });
    const actualReceiptCount = await prisma.pO_Receipt.count({ 
      where: { receiptNo: { not: { startsWith: 'VIRTUAL' } } } 
    });

    console.log(`   虛擬 Receipt（VIRTUAL-*）: ${virtualReceiptCount} 個`);
    console.log(`   實際 Receipt: ${actualReceiptCount} 個\n`);

    // 3. 應付帳款來源
    console.log('3️⃣  應付帳款（FIN_Payable）來源\n');

    const totalAP = await prisma.fIN_Payable.count();
    const apWithReceipt = await prisma.fIN_Payable.count({ where: { receiptId: { not: null } } });
    const apWithShipment = await prisma.fIN_Payable.count({ where: { shipmentId: { not: null } } });
    const apWithPo = await prisma.fIN_Payable.count({ where: { poId: { not: null } } });

    console.log(`   總應付帳款: ${totalAP} 個`);
    console.log(`   - 有 receiptId（PO 入庫）: ${apWithReceipt} 個`);
    console.log(`   - 有 shipmentId（出貨觸發）: ${apWithShipment} 個`);
    console.log(`   - 有 poId: ${apWithPo} 個\n`);

    // 4. 應收帳款
    console.log('4️⃣  應收帳款（FIN_Receivable）\n');

    const arCount = await prisma.fIN_Receivable.count();
    console.log(`   總應收帳款: ${arCount} 個\n`);

    // 5. 出貨單
    console.log('5️⃣  出貨單（SLS）\n');

    const slsCount = await prisma.sLS.count();
    console.log(`   總出貨單: ${slsCount} 個\n`);

    // 6. 潛在的數據衝突
    console.log('6️⃣  潛在的數據衝突\n');

    // 6a. 同一個 PO 多個虛擬 receipt
    const poWithMultiVirtualReceipts = await prisma.pO_Receipt.groupBy({
      by: ['orderId'],
      where: { receiptNo: { startsWith: 'VIRTUAL' } },
      having: {
        id: { _count: { gt: 1 } },
      },
      _count: { id: true },
    });

    if (poWithMultiVirtualReceipts.length > 0) {
      console.log(`   ⚠️  ${poWithMultiVirtualReceipts.length} 個 PO 有多個虛擬 Receipt：`);
      for (const group of poWithMultiVirtualReceipts.slice(0, 3)) {
        console.log(`      PO ID=${group.orderId}: ${group._count.id} 個虛擬 Receipt`);
      }
    } else {
      console.log(`   ✅ 無 PO 有多個虛擬 Receipt`);
    }

    // 6b. 同一個出貨的應付帳款重複
    const shipmentsWithMultiAP = await prisma.fIN_Payable.groupBy({
      by: ['shipmentId'],
      where: { shipmentId: { not: null } },
      having: {
        id: { _count: { gt: 1 } },
      },
      _count: { id: true },
    });

    if (shipmentsWithMultiAP.length > 0) {
      console.log(`\n   ⚠️  ${shipmentsWithMultiAP.length} 個出貨單有多筆應付帳款`);
      for (const group of shipmentsWithMultiAP.slice(0, 3)) {
        const shipment = await prisma.sLS.findUnique({
          where: { id: group.shipmentId },
          select: { shipmentNo: true },
        });
        console.log(`      ${shipment?.shipmentNo}: ${group._count.id} 筆應付帳款`);
      }
    } else {
      console.log(`\n   ✅ 無出貨單有多筆應付帳款`);
    }

    // 6c. Receipt 沒有對應應付帳款
    const receiptsWithoutAP = await prisma.pO_Receipt.findMany({
      where: {
        NOT: {
          payable: { isNot: null },
        },
      },
      select: { id: true, receiptNo: true },
    });

    if (receiptsWithoutAP.length > 0) {
      console.log(`\n   ⚠️  ${receiptsWithoutAP.length} 個 Receipt 無對應應付帳款`);
    } else {
      console.log(`\n   ✅ 所有 Receipt 都有對應應付帳款`);
    }

    // 7. 總結
    console.log('\n' + '='.repeat(80));
    console.log('📊 數據統計摘要\n');
    console.log(`   • PI: ${piCount}`);
    console.log(`   • PO: ${poCount}`);
    console.log(`   • Shipment: ${slsCount}`);
    console.log(`   • 應付帳款: ${totalAP}`);
    console.log(`   • 應收帳款: ${arCount}`);
    console.log(`   • Receipt（虛擬+實際）: ${virtualReceiptCount + actualReceiptCount}`);
    console.log('\n' + '='.repeat(80) + '\n');

  } catch (err) {
    console.error('❌ 審查失敗:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

systemAudit();
