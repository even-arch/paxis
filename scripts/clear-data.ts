/**
 * 清除所有交易資料（產品、採購、銷售、庫存）
 * 保留：供應商、客戶、使用者、公司設定、幣別
 *
 * 執行方式：npx tsx scripts/clear-data.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('開始清除資料...')

  // 銷售側（由子到父）
  const slsShipItem = await prisma.sLS_Item.deleteMany()
  console.log(`✓ SLS_Item: ${slsShipItem.count} 筆`)

  const slsShipment = await prisma.sLS.deleteMany()
  console.log(`✓ SLS: ${slsShipment.count} 筆`)

  const slsPiItem = await prisma.pI_Item.deleteMany()
  console.log(`✓ PI_Item: ${slsPiItem.count} 筆`)

  const slsPi = await prisma.pI.deleteMany()
  console.log(`✓ PI: ${slsPi.count} 筆`)

  const slsItem = await prisma.pO_CustomerCopy_Item.deleteMany()
  console.log(`✓ PO_CustomerCopy_Item: ${slsItem.count} 筆`)

  const slsOrder = await prisma.pO_CustomerCopy.deleteMany()
  console.log(`✓ PO_CustomerCopy: ${slsOrder.count} 筆`)

  // 採購側（由子到父）
  const supPiItem = await prisma.pI_SupplierCopy_Item.deleteMany()
  console.log(`✓ PI_SupplierCopy_Item: ${supPiItem.count} 筆`)

  const supPi = await prisma.pI_SupplierCopy.deleteMany()
  console.log(`✓ PI_SupplierCopy: ${supPi.count} 筆`)

  const recItem = await prisma.pO_ReceiptItem.deleteMany()
  console.log(`✓ PO_ReceiptItem: ${recItem.count} 筆`)

  const receipt = await prisma.pO_Receipt.deleteMany()
  console.log(`✓ PO_Receipt: ${receipt.count} 筆`)

  const poItem = await prisma.pO_Item.deleteMany()
  console.log(`✓ PO_Item: ${poItem.count} 筆`)

  const poOrder = await prisma.pO.deleteMany()
  console.log(`✓ PO: ${poOrder.count} 筆`)

  // 庫存
  const invMovement = await prisma.iNV_Movement.deleteMany()
  console.log(`✓ INV_Movement: ${invMovement.count} 筆`)

  const invStock = await prisma.iNV_Stock.deleteMany()
  console.log(`✓ INV_Stock: ${invStock.count} 筆`)

  // 商品相關
  const costSheet = await prisma.cOST_Sheet.deleteMany()
  console.log(`✓ COST_Sheet: ${costSheet.count} 筆`)

  const prodHistory = await prisma.pRD_ProductHistory.deleteMany()
  console.log(`✓ PRD_ProductHistory: ${prodHistory.count} 筆`)

  const catMap = await prisma.pRD_CategoryMapping.deleteMany()
  console.log(`✓ PRD_CategoryMapping: ${catMap.count} 筆`)

  const supProd = await prisma.sUP_SupplierProduct.deleteMany()
  console.log(`✓ SUP_SupplierProduct: ${supProd.count} 筆`)

  const product = await prisma.pRD_Product.deleteMany()
  console.log(`✓ PRD_Product: ${product.count} 筆`)

  console.log('\n✅ 清除完成。供應商、客戶、使用者資料保留。')
}

main()
  .catch(e => { console.error('❌ 錯誤：', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
