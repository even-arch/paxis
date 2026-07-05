const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPIAPRelationship() {
  try {
    console.log('\n🔗 PI 和應付帳款的關係檢查\n');

    // 那三張出貨單對應的 PI
    const shipmentNos = ['S250624', 'S250909', 'S251223'];

    for (const shipmentNo of shipmentNos) {
      const shipment = await prisma.sLS.findFirst({
        where: { shipmentNo },
        include: {
          pis: {
            include: {
              pi: { select: { id: true, piNo: true } },
            },
          },
        },
      });

      if (!shipment) continue;

      const piIds = shipment.pis.map(p => p.pi.id);
      const piNos = shipment.pis.map(p => p.pi.piNo).join(', ');

      console.log(`\n📦 出貨單：${shipmentNo}`);
      console.log(`   PI 號：${piNos || '(無)'}`);
      console.log(`   PI 數量：${piIds.length}`);

      // 查這個出貨單的應付帳款
      const aps = await prisma.fIN_Payable.findMany({
        where: { shipmentId: shipment.id },
        include: {
          po: { select: { poNo: true } },
        },
      });

      console.log(`   應付帳款數量：${aps.length}`);

      // 檢查 PO 對應的 PI
      if (aps.length > 0) {
        console.log(`   應付帳款對應的 PO：`);
        for (const ap of aps) {
          console.log(`      • PO ${ap.po?.poNo} (金額=${ap.amountTWD})`);
        }
      }
    }

    // 檢查是否同一 PI 出現在多個出貨單的應付帳款
    console.log('\n\n🔍 檢查 PI 重複跨出貨的情況\n');

    const allAPs = await prisma.fIN_Payable.findMany({
      include: {
        po: {
          select: {
            poNo: true,
            slsPiId: true,
            pi: { select: { piNo: true } },
          },
        },
        shipment: { select: { shipmentNo: true } },
      },
    });

    // 按 PI 分組
    const piToShipments = new Map();
    for (const ap of allAPs) {
      if (!ap.po || !ap.po.slsPiId) continue;
      const key = ap.po.slsPiId;
      if (!piToShipments.has(key)) {
        piToShipments.set(key, {
          piNo: ap.po.pi?.piNo,
          shipments: new Set(),
        });
      }
      piToShipments.get(key).shipments.add(ap.shipment?.shipmentNo);
    }

    // 找出重複的 PI
    let duplicateCount = 0;
    for (const [piId, data] of piToShipments) {
      if (data.shipments.size > 1) {
        console.log(`❌ PI ${data.piNo} 出現在 ${data.shipments.size} 個出貨單：`);
        console.log(`   ${Array.from(data.shipments).join(', ')}`);
        duplicateCount++;
      }
    }

    if (duplicateCount === 0) {
      console.log('✅ 無 PI 重複跨出貨單的情況');
    }

  } catch (err) {
    console.error('❌ 錯誤:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkPIAPRelationship();
