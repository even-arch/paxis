import { PrismaClient } from '@prisma/client'

export type OutstandingNotice = { id: number; noticeNo: string; status: string; supplierName: string }
export type OutstandingItems = { notices: OutstandingNotice[]; shipmentConfirmed: boolean }

/**
 * 出貨單「尚未收尾」的項目：狀態未到 CONFIRMED 的供應商出貨通知單，
 * 以及庫存是否已確認扣減（INV_Movement type=4）。
 *
 * 供「確認出貨」按鈕使用：按下確認出貨時，一併呈現這些項目讓使用者
 * 決定要不要順便收尾（例如供應商已用 LINE/電話確認，只是沒走系統
 * Email 流程）。與是否上傳過報關文件無關。
 */
export async function getOutstandingItems(prisma: PrismaClient, shipmentId: number): Promise<OutstandingItems> {
  const notices = await prisma.pO_ShippingNotice.findMany({
    where: { sourceShipmentId: shipmentId, status: { not: 'CONFIRMED' } },
    select: {
      id: true, noticeNo: true, status: true,
      supplier: { select: { name: true, shortName: true } },
    },
    orderBy: { noticeNo: 'asc' },
  })
  const invMovements = await prisma.iNV_Movement.findMany({
    where: { slsShipmentId: shipmentId, type: 4 },
    select: { id: true },
    take: 1,
  })

  return {
    notices: notices.map(n => ({
      id: n.id, noticeNo: n.noticeNo, status: n.status,
      supplierName: n.supplier.shortName ?? n.supplier.name,
    })),
    shipmentConfirmed: invMovements.length > 0,
  }
}
