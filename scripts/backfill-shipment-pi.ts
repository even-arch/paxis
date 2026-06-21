/**
 * 補建出貨單 ↔ PI 關聯（SLS_PI_Link）
 * 執行：npx ts-node --project tsconfig.json scripts/backfill-shipment-pi.ts
 */
import { PrismaClient } from '@prisma/client'
import { getDeliveryOrderDetail, patiscoLogin } from '../src/api/patisco/client'

const prisma = new PrismaClient()

async function main() {
  // 1. 取 Patisco 憑證
  const creds = await patiscoLogin(prisma as any)
  if (!creds) { console.error('無法取得 Patisco 憑證，請確認設定'); return }

  // 2. 找所有沒有 PI 關聯的出貨單
  const shipments = await prisma.sLS.findMany({
    where: {
      pis: { none: {} },
      patiscoDocId: { not: null },
      source: 'PATISCO',
    },
    select: { id: true, shipmentNo: true, patiscoDocId: true },
    orderBy: { id: 'asc' },
  })

  console.log(`找到 ${shipments.length} 筆出貨單需要補 PI 關聯`)

  for (const s of shipments) {
    const docId = s.patiscoDocId!
    console.log(`\n處理 ${s.shipmentNo} (patiscoDocId=${docId})`)

    // 3. 呼叫 Patisco 取 detail
    const [ciRes, plRes] = await Promise.all([
      getDeliveryOrderDetail(creds, docId, 'commercialInvoice'),
      getDeliveryOrderDetail(creds, docId, 'packingList'),
    ])

    const extractDetail = (res: typeof ciRes) => {
      if (!res.ok || !res.data) return null
      const d = res.data as any
      return d.detail ?? d.item ?? (d.id ? d : null)
    }
    const ci = extractDetail(ciRes)
    const pl = extractDetail(plRes)
    const detail = ci ?? pl

    if (!detail) {
      console.log(`  ✗ 無法取得 detail（ciOk=${ciRes.ok} plOk=${plRes.ok}）`)
      continue
    }

    const ordersList: Array<{ no?: string; id?: string }> = detail.orders ?? []
    const packingItems: Array<{ sourceOrderID?: string }> = (pl ?? ci)?.packings ?? []

    console.log(`  orders: ${ordersList.length} 筆 | packings: ${packingItems.length} 筆`)
    if (ordersList.length > 0) console.log(`  orders sample:`, JSON.stringify(ordersList.slice(0, 3)))

    const linkedPiIds = new Set<number>()

    // 策略一：orders[].no / orders[].id → PI
    for (const ord of ordersList) {
      const piNo = ord.no?.trim()
      const srcId = ord.id?.trim()
      if (!piNo && !srcId) continue
      const pi = await prisma.pI.findFirst({
        where: piNo
          ? { OR: [{ piNo }, ...(srcId ? [{ patiscoDocId: srcId }] : [])] }
          : { patiscoDocId: srcId! },
        select: { id: true, piNo: true },
      })
      if (pi) {
        console.log(`  ✓ [策略一] PI: ${pi.piNo} (id=${pi.id})`)
        linkedPiIds.add(pi.id)
      } else {
        console.log(`  ~ [策略一] 找不到 PI: no=${piNo} id=${srcId}`)
      }
    }

    // 策略二：packings[].sourceOrderID → PI
    for (const p of packingItems) {
      const sid = (p as any).sourceOrderID
      if (!sid) continue
      const pi = await prisma.pI.findFirst({
        where: { patiscoDocId: sid },
        select: { id: true, piNo: true },
      })
      if (pi && !linkedPiIds.has(pi.id)) {
        console.log(`  ✓ [策略二] PI: ${pi.piNo} (id=${pi.id})`)
        linkedPiIds.add(pi.id)
      }
    }

    if (linkedPiIds.size === 0) {
      console.log(`  ✗ 找不到任何 PI，跳過`)
      continue
    }

    // 4. 建立 SLS_PI_Link
    for (const piId of Array.from(linkedPiIds)) {
      await prisma.sLS_PI_Link.upsert({
        where: { shipmentId_piId: { shipmentId: s.id, piId } },
        create: { shipmentId: s.id, piId },
        update: {},
      })
    }
    console.log(`  ✓ 建立 ${linkedPiIds.size} 個 PI 關聯`)
  }

  const withPi = await prisma.sLS.count({ where: { pis: { some: {} } } })
  const total = await prisma.sLS.count()
  console.log(`\n完成。${total} 筆出貨單，${withPi} 筆有 PI 關聯，${total - withPi} 筆仍無`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
