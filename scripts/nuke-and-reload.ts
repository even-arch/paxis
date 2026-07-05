import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function nukeAndReload() {
  try {
    console.log('🔥 清理所有應付帳款和相關記錄...\n')

    // 取得所有出貨單
    const shipments = await prisma.sLS.findMany({
      select: { id: true, shipmentNo: true },
    })

    console.log(`📦 找到 ${shipments.length} 個出貨單\n`)

    // 1. 刪除所有 FIN_Payable
    const deletedPayables = await prisma.fIN_Payable.deleteMany({})
    console.log(`✅ 刪除 ${deletedPayables.count} 筆應付帳款`)

    // 2. 刪除虛擬 PO_Receipt（VIRTUAL-* 開頭的）
    const deletedReceipts = await prisma.pO_Receipt.deleteMany({
      where: {
        receiptNo: { startsWith: 'VIRTUAL' },
      },
    })
    console.log(`✅ 刪除 ${deletedReceipts.count} 個虛擬收據`)

    // 3. 重置 INV_Movement type=4（出貨記錄）
    const deletedMovements = await prisma.iNV_Movement.deleteMany({
      where: {
        type: 4, // 出貨異動
        slsShipmentId: { in: shipments.map(s => s.id) },
      },
    })
    console.log(`✅ 刪除 ${deletedMovements.count} 個出貨庫存異動`)

    // 4. 重置 SLS_ShipmentItem.shippedQty （先取得 shipment items）
    const shipmentItems = await prisma.sLS_Item.findMany({
      where: { shipmentId: { in: shipments.map(s => s.id) } },
      select: { slsItemId: true },
    })

    if (shipmentItems.length > 0) {
      await prisma.pO_CustomerCopy_Item.updateMany({
        where: {
          id: { in: shipmentItems.map(si => si.slsItemId).filter((id): id is number => id != null) },
        },
        data: { shippedQty: 0 },
      })
      console.log(`✅ 重置 ${shipmentItems.length} 個訂單品項的已出貨數`)
    }

    // 5. 重置 PO_CustomerCopy 狀態
    const orders = await prisma.pO_CustomerCopy.findMany({
      select: { id: true },
    })
    if (orders.length > 0) {
      await prisma.pO_CustomerCopy.updateMany({
        data: { status: 1 }, // 回到初始狀態
      })
      console.log(`✅ 重置 ${orders.length} 個銷售訂單狀態`)
    }

    console.log(`\n\n${'='.repeat(60)}`)
    console.log(`🧹 清理完成！現在可以重新確認出貨單了`)
    console.log(`${'='.repeat(60)}`)
    console.log(`\n📋 下一步：`)
    console.log(`1. 進入每個出貨單詳情頁`)
    console.log(`2. 點擊「確認出貨」按鈕`)
    console.log(`3. 應付帳款會根據新的優先級邏輯重新建立`)
    console.log(`\n💡 新邏輯會：`)
    console.log(`   • 優先用 slsPiId FK 連結`)
    console.log(`   • 其次用 poNo 精確相等`)
    console.log(`   • 最後用 salesOrderId 連結`)
    console.log(`   • 同一個 PO 只建立一次應付帳款`)

  } catch (err) {
    console.error('❌ 清理失敗:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

nukeAndReload()
