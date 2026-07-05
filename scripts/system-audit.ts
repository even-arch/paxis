import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function systemAudit() {
  try {
    console.log('\n' + '='.repeat(80))
    console.log('🔍 PAXIS 系統完整審查')
    console.log('='.repeat(80) + '\n')

    // ==================== 1. PI ↔ PO 對帳機制 ====================
    console.log('1️⃣  PI ↔ PO 對帳機制\n')

    const piWithPo = await prisma.pI.findMany({
      select: {
        id: true,
        piNo: true,
        poOrders: { select: { id: true, poNo: true } },
      },
      take: 5,
    })

    console.log(`   PI 與 PO 的對應關係：`)
    console.log(`   - 查詢前 5 個 PI...`)
    for (const pi of piWithPo) {
      console.log(`      PI ${pi.piNo}: 對應 ${pi.poOrders.length} 個 PO`)
      pi.poOrders.forEach(po => console.log(`         • PO ${po.poNo}`))
    }

    // 檢查 slsPiId 欄位
    const posWithSlsPiId = await prisma.pO.findMany({
      where: { slsPiId: { not: null } },
      select: { id: true, poNo: true, slsPiId: true },
      take: 5,
    })

    console.log(`\n   PO 中的 slsPiId 欄位（FK 連結）：`)
    console.log(`   - 有 slsPiId 的 PO: ${await prisma.pO.count({ where: { slsPiId: { not: null } } })} 個`)
    for (const po of posWithSlsPiId) {
      console.log(`      PO ${po.poNo}: slsPiId=${po.slsPiId}`)
    }

    // ==================== 2. 出貨確認流程 ====================
    console.log('\n\n2️⃣  出貨確認流程\n')

    const shipments = await prisma.sLS.findMany({
      select: {
        id: true,
        shipmentNo: true,
        actualShipDate: true,
        pis: { select: { piId: true } },
        payable: { select: { id: true } },
        stockMovements: { where: { type: 4 }, select: { id: true } },
      },
      take: 3,
    })

    console.log(`   出貨單詳情（前 3 個）：`)
    for (const s of shipments) {
      console.log(`      出貨單 ${s.shipmentNo}:`)
      console.log(`        - 關聯 PI: ${s.pis.length} 個`)
      console.log(`        - 應付帳款: ${s.payable.length} 個`)
      console.log(`        - 庫存異動(type=4): ${s.stockMovements.length} 個`)
    }

    // ==================== 3. Receipt 類型 ====================
    console.log('\n\n3️⃣  PO_Receipt 類型\n')

    const virtualReceipts = await prisma.pO_Receipt.findMany({
      where: { receiptNo: { startsWith: 'VIRTUAL' } },
      select: { id: true, receiptNo: true, orderId: true },
      take: 3,
    })

    const actualReceipts = await prisma.pO_Receipt.findMany({
      where: { receiptNo: { not: { startsWith: 'VIRTUAL' } } },
      select: { id: true, receiptNo: true, orderId: true },
      take: 3,
    })

    console.log(`   虛擬 Receipt（VIRTUAL-*）: ${await prisma.pO_Receipt.count({ where: { receiptNo: { startsWith: 'VIRTUAL' } } })} 個`)
    console.log(`   實際 Receipt: ${await prisma.pO_Receipt.count({ where: { receiptNo: { not: { startsWith: 'VIRTUAL' } } } })} 個`)

    if (virtualReceipts.length > 0) {
      console.log(`\n   虛擬 Receipt 範例：`)
      virtualReceipts.forEach(r => console.log(`      ${r.receiptNo} (PO ID=${r.orderId})`))
    }

    // ==================== 4. 應付帳款來源 ====================
    console.log('\n\n4️⃣  應付帳款（FIN_Payable）來源\n')

    const apBySource = await prisma.fIN_Payable.findMany({
      select: {
        id: true,
        receiptId: true,
        shipmentId: true,
        poId: true,
        supplierId: true,
        amountTWD: true,
      },
      take: 10,
    })

    console.log(`   總應付帳款: ${await prisma.fIN_Payable.count()} 個`)
    console.log(`\n   來源類型分布：`)

    const apWithReceipt = apBySource.filter(ap => ap.receiptId)
    const apWithShipment = apBySource.filter(ap => ap.shipmentId)
    const apWithPo = apBySource.filter(ap => ap.poId)

    console.log(`      - 有 receiptId 的: ${apWithReceipt.length} 個（PO 入庫）`)
    console.log(`      - 有 shipmentId 的: ${apWithShipment.length} 個（出貨觸發）`)
    console.log(`      - 有 poId 的: ${apWithPo.length} 個`)

    console.log(`\n   應付帳款範例（前 5 個）：`)
    apBySource.slice(0, 5).forEach(ap => {
      const source = ap.receiptId ? 'Receipt' : ap.shipmentId ? 'Shipment' : 'PO'
      console.log(`      ID=${ap.id}, 來源=${source}, 金額=${ap.amountTWD}`)
    })

    // ==================== 5. 應收帳款來源 ====================
    console.log('\n\n5️⃣  應收帳款（FIN_Receivable）來源\n')

    const arBySource = await prisma.fIN_Receivable.findMany({
      select: {
        id: true,
        shipmentId: true,
        amountTWD: true,
      },
      take: 5,
    })

    console.log(`   總應收帳款: ${await prisma.fIN_Receivable.count()} 個`)
    console.log(`\n   應收帳款範例（前 5 個）：`)
    arBySource.forEach(ar => {
      console.log(`      ID=${ar.id}, shipmentId=${ar.shipmentId}, 金額=${ar.amountTWD}`)
    })

    // ==================== 6. 潛在的數據衝突 ====================
    console.log('\n\n6️⃣  潛在的數據衝突\n')

    // 6a. 同一個 PO 多個虛擬 receipt
    const poWithMultiReceipts = await prisma.pO_Receipt.groupBy({
      by: ['orderId'],
      having: {
        id: { _count: { gt: 1 } },
      },
      _count: { id: true },
    })

    if (poWithMultiReceipts.length > 0) {
      console.log(`   ⚠️  ${poWithMultiReceipts.length} 個 PO 有多個 Receipt：`)
      for (const group of poWithMultiReceipts.slice(0, 3)) {
        const receipts = await prisma.pO_Receipt.findMany({
          where: { orderId: group.orderId },
          select: { receiptNo: true },
        })
        console.log(`      PO ID=${group.orderId}: ${receipts.map(r => r.receiptNo).join(', ')}`)
      }
    }

    // 6b. 同一個出貨的應付帳款重複
    const shipmentsWithDupAP = await prisma.fIN_Payable.groupBy({
      by: ['shipmentId'],
      having: {
        id: { _count: { gt: 1 } },
      },
      _count: { id: true },
    })

    if (shipmentsWithDupAP.length > 0) {
      console.log(`\n   ⚠️  ${shipmentsWithDupAP.length} 個出貨單有多筆應付帳款`)
    }

    // 6c. PI 被多個出貨引用
    const piMultiShipments = await prisma.sLS_PI_Link.groupBy({
      by: ['piId'],
      having: {
        id: { _count: { gt: 1 } },
      },
      _count: { id: true },
    })

    if (piMultiShipments.length > 0) {
      console.log(`\n   ℹ️  ${piMultiShipments.length} 個 PI 被多個出貨單引用（正常 - 分批出貨）`)
    }

    // ==================== 7. 總結 ====================
    console.log('\n\n' + '='.repeat(80))
    console.log('📊 數據統計摘要\n')

    const stats = await Promise.all([
      prisma.pI.count(),
      prisma.pO.count(),
      prisma.sLS.count(),
      prisma.fIN_Payable.count(),
      prisma.fIN_Receivable.count(),
      prisma.pO_Receipt.count(),
    ])

    console.log(`   • PI: ${stats[0]}`)
    console.log(`   • PO: ${stats[1]}`)
    console.log(`   • Shipment: ${stats[2]}`)
    console.log(`   • 應付帳款: ${stats[3]}`)
    console.log(`   • 應收帳款: ${stats[4]}`)
    console.log(`   • Receipt: ${stats[5]}`)
    console.log('\n' + '='.repeat(80) + '\n')

  } catch (err) {
    console.error('❌ 審查失敗:', err instanceof Error ? err.message : String(err))
  } finally {
    await prisma.$disconnect()
  }
}

systemAudit()
