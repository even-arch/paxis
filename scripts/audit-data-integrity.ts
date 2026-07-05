import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function auditDataIntegrity() {
  try {
    console.log('\n' + '='.repeat(70))
    console.log('📊 PAXIS 資料整齊度審查')
    console.log('='.repeat(70) + '\n')

    // ==================== 1. 基本統計 ====================
    console.log('📈 1. 基本統計\n')
    const [shipmentCount, payableCount, receivableCount, receiptCount, poCount] = await Promise.all([
      prisma.sLS.count(),
      prisma.fIN_Payable.count(),
      prisma.fIN_Receivable.count(),
      prisma.pO_Receipt.count(),
      prisma.pO.count(),
    ])

    console.log(`   出貨單（SLS）：${shipmentCount} 筆`)
    console.log(`   應付帳款（FIN_Payable）：${payableCount} 筆`)
    console.log(`   應收帳款（FIN_Receivable）：${receivableCount} 筆`)
    console.log(`   收據（PO_Receipt）：${receiptCount} 筆`)
    console.log(`   採購單（PO）：${poCount} 筆\n`)

    let issueCount = 0

    // ==================== 2. 應付帳款檢查 ====================
    console.log('💰 2. 應付帳款（AP）檢查\n')

    // 2a. 檢查重複
    const dupPayables = await prisma.fIN_Payable.groupBy({
      by: ['receiptId'],
      having: {
        id: {
          _count: { gt: 1 },
        },
      },
    })

    if (dupPayables.length === 0) {
      console.log(`   ✅ 無重複：每個 receipt 最多 1 筆應付帳款`)
    } else {
      console.log(`   ❌ 發現 ${dupPayables.length} 個 receipt 有重複應付帳款`)
      for (const dup of dupPayables) {
        const count = await prisma.fIN_Payable.count({ where: { receiptId: dup.receiptId } })
        console.log(`      • receiptId=${dup.receiptId}: ${count} 筆`)
      }
      issueCount += dupPayables.length
    }

    // 2b. 檢查應付帳款金額
    const negativePayables = await prisma.fIN_Payable.findMany({
      where: {
        amountTWD: { lte: 0 },
      },
      select: { id: true },
    })

    if (negativePayables.length === 0) {
      console.log(`   ✅ 金額正常：所有應付帳款金額 > 0\n`)
    } else {
      console.log(`   ❌ 發現 ${negativePayables.length} 筆負數或零金額的應付帳款\n`)
      issueCount += negativePayables.length
    }

    // ==================== 3. 應收帳款檢查 ====================
    console.log('🤑 3. 應收帳款（AR）檢查\n')

    // 3a. 檢查應收帳款金額
    const negativeReceivables = await prisma.fIN_Receivable.findMany({
      where: {
        amountTWD: { lte: 0 },
      },
      select: { id: true },
    })

    if (negativeReceivables.length === 0) {
      console.log(`   ✅ 金額正常：所有應收帳款金額 > 0\n`)
    } else {
      console.log(`   ❌ 發現 ${negativeReceivables.length} 筆負數或零金額的應收帳款\n`)
      issueCount += negativeReceivables.length
    }

    // ==================== 4. 庫存檢查 ====================
    console.log('📦 4. 庫存（Inventory）檢查\n')

    const stocks = await prisma.iNV_Stock.findMany({
      select: { productId: true, quantity: true, reservedQty: true },
    })

    const negativeStocks = stocks.filter(s => s.quantity < 0 || s.reservedQty < 0)
    const invalidReserved = stocks.filter(s => s.reservedQty > s.quantity)

    if (negativeStocks.length === 0) {
      console.log(`   ✅ 無負庫存：所有庫存數量 ≥ 0`)
    } else {
      console.log(`   ❌ 發現 ${negativeStocks.length} 個品項有負庫存`)
      issueCount += negativeStocks.length
    }

    if (invalidReserved.length === 0) {
      console.log(`   ✅ 預留正常：reservedQty ≤ quantity\n`)
    } else {
      console.log(`   ❌ 發現 ${invalidReserved.length} 個品項預留量 > 庫存量\n`)
      issueCount += invalidReserved.length
    }

    // ==================== 5. PO & Receipt 匹配 ====================
    console.log('🛒 5. 採購單與收據匹配\n')

    const allReceipts = await prisma.pO_Receipt.findMany({
      select: { id: true, receiptNo: true },
    })

    const receiptsWithPayable = new Set(
      (await prisma.fIN_Payable.findMany({
        select: { receiptId: true },
      })).map(p => p.receiptId)
    )

    const receiptsWithoutPayable = allReceipts.filter(r => !receiptsWithPayable.has(r.id))

    if (receiptsWithoutPayable.length === 0) {
      console.log(`   ✅ 完整：所有收據都有對應的應付帳款\n`)
    } else {
      console.log(`   ⚠️  發現 ${receiptsWithoutPayable.length} 個收據無應付帳款`)
      receiptsWithoutPayable.slice(0, 5).forEach(r => {
        console.log(`      • ${r.receiptNo}`)
      })
      console.log()
    }

    // ==================== 總結 ====================
    console.log('='.repeat(70))
    if (issueCount === 0) {
      console.log('✅ 完美！資料完全整齊，無任何異常。')
    } else {
      console.log(`⚠️  發現 ${issueCount} 個問題，請檢查上方標記 ❌ 的項目。`)
    }
    console.log('='.repeat(70) + '\n')

  } catch (err) {
    console.error('❌ 審查失敗:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

auditDataIntegrity()
