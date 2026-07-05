import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupVirtualReceipts() {
  try {
    console.log('\n' + '='.repeat(80))
    console.log('🧹 清理虛擬 Receipt 和對應的應付帳款')
    console.log('='.repeat(80) + '\n')

    // 1. 找出虛擬 receipt（VIRTUAL-* 開頭）
    const virtualReceipts = await prisma.pO_Receipt.findMany({
      where: { receiptNo: { startsWith: 'VIRTUAL' } },
      select: { id: true, receiptNo: true },
    })

    console.log(`找到 ${virtualReceipts.length} 個虛擬 Receipt：`)
    virtualReceipts.slice(0, 5).forEach(r => console.log(`  • ${r.receiptNo}`))
    if (virtualReceipts.length > 5) console.log(`  ... 還有 ${virtualReceipts.length - 5} 個`)

    // 2. 找出這些虛擬 receipt 對應的應付帳款
    const virtualReceiptIds = virtualReceipts.map(r => r.id)
    const apToDelete = await prisma.fIN_Payable.findMany({
      where: { receiptId: { in: virtualReceiptIds } },
      select: { id: true, amountTWD: true },
    })

    console.log(`\n找到 ${apToDelete.length} 筆應付帳款需要刪除：`)
    let totalAmount = 0
    apToDelete.forEach(ap => {
      totalAmount += Number(ap.amountTWD)
    })
    console.log(`  總金額：${totalAmount}`)

    // 3. 確認要刪除
    console.log('\n準備刪除：')
    console.log(`  1. ${virtualReceipts.length} 個虛擬 Receipt`)
    console.log(`  2. ${apToDelete.length} 筆應付帳款`)

    // 4. 執行刪除
    console.log('\n開始刪除...\n')

    const deletedAP = await prisma.fIN_Payable.deleteMany({
      where: { receiptId: { in: virtualReceiptIds } },
    })

    const deletedReceipts = await prisma.pO_Receipt.deleteMany({
      where: { receiptNo: { startsWith: 'VIRTUAL' } },
    })

    console.log(`✅ 刪除完成：`)
    console.log(`   • 應付帳款：${deletedAP.count} 筆`)
    console.log(`   • 虛擬 Receipt：${deletedReceipts.count} 個`)

    console.log('\n' + '='.repeat(80) + '\n')

  } catch (err) {
    console.error('❌ 清理失敗:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

cleanupVirtualReceipts()
