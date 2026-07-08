/**
 * GET /api/print/shipping-notice/[id]
 * 出貨通知單 A4 列印資料。
 * 品項的箱號/箱數/材積/毛淨重「原封不動」取自來源出貨單的 SLS_Item
 * （依 rawSku 比對此通知單供應商的品項），箱號順序以 PI 為單位。
 * 絕不包含 Commercial Invoice 金額（客戶報價不可讓供應商看到）。
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { filterMarksForDocNos } from '@/lib/shipping-marks'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const notice = await prisma.pO_ShippingNotice.findUnique({
    where: { id },
    include: {
      supplier: {
        select: {
          id: true, name: true, shortName: true, address: true, city: true,
          countryCode: true, phoneNo: true, fax: true, email: true, contactPerson: true,
        },
      },
      items: {
        include: {
          po: { select: { id: true, poNo: true, slsPi: { select: { piNo: true } } } },
          product: { select: { id: true, sku: true, name: true, unit: true } },
        },
      },
      performer: { select: { name: true } },
      sourceShipment: true,
    },
  })

  if (!notice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const company = await prisma.sYS_Company.findFirst()
  const shipment = notice.sourceShipment

  // 供應商品項的 SKU 集合 → 從出貨單抓對應的裝箱明細（原封不動）
  const noticeSkus = new Set(
    notice.items.map(it => it.product.sku).filter((s): s is string => !!s),
  )

  type PackingRow = {
    piNo: string | null
    poNo: string | null
    sku: string | null
    productName: string | null
    quantity: number
    unit: string | null
    cartons: number | null
    cartonNoFrom: string | null
    cartonNoTo: string | null
    cubicFt: string | null
    cbm: string | null
    netWeightKg: string | null
    grossWeightKg: string | null
  }

  let packingRows: PackingRow[] = []
  if (shipment) {
    const slsItems = await prisma.sLS_Item.findMany({
      where: { shipmentId: shipment.id },
      include: {
        pi: { select: { piNo: true } },
        slsItem: { select: { unit: true, product: { select: { sku: true, name: true } } } },
      },
      orderBy: [{ piId: 'asc' }, { id: 'asc' }],
    })

    // SKU → PO 號對照（同 SKU 出現在多張 PO 時取第一張）
    const poBySku = new Map<string, string>()
    for (const it of notice.items) {
      if (it.product.sku && !poBySku.has(it.product.sku)) {
        poBySku.set(it.product.sku, it.po.poNo)
      }
    }

    packingRows = slsItems
      .filter(it => {
        const sku = it.rawSku ?? it.slsItem?.product?.sku
        return sku != null && noticeSkus.has(sku)
      })
      .map(it => {
        const sku = it.rawSku ?? it.slsItem?.product?.sku ?? null
        return {
          piNo: it.pi?.piNo ?? null,
          poNo: sku ? poBySku.get(sku) ?? null : null,
          sku,
          productName: it.rawProductName ?? it.slsItem?.product?.name ?? null,
          quantity: it.quantity,
          unit: (it as unknown as { unit?: string | null }).unit ?? it.slsItem?.unit ?? null,
          cartons: it.cartons ?? null,
          cartonNoFrom: it.cartonNoFrom ?? null,
          cartonNoTo: it.cartonNoTo ?? null,
          cubicFt: it.cubicFt?.toString() ?? null,
          cbm: it.cbm?.toString() ?? null,
          netWeightKg: it.netWeightKg?.toString() ?? null,
          grossWeightKg: it.grossWeightKg?.toString() ?? null,
        }
      })
  }

  return NextResponse.json({
    notice: {
      id: notice.id,
      noticeNo: notice.noticeNo,
      issueDate: notice.issueDate,
      status: notice.status,
      note: notice.note,
      deliverToName: notice.deliverToName,
      deliverToAddress: notice.deliverToAddress,
      deliverToContact: notice.deliverToContact,
      inCharge: notice.performer?.name ?? null,
      items: notice.items.map(it => ({
        poNo: it.po.poNo,
        sku: it.product.sku,
        name: it.product.name,
        poQuantity: it.poQuantity,
        notifiedQuantity: it.notifiedQuantity,
        unit: it.unit ?? it.product.unit ?? 'PCS',
        // 不回傳 unitPrice：通知單不含任何金額
      })),
    },
    supplier: notice.supplier,
    company: company ? {
      nameZh: company.nameZh,
      nameEn: company.nameEn,
      addressZh: company.addressZh,
      addressEn: company.addressEn,
      phone: company.phone,
      fax: company.fax,
      email: company.email,
      logoBase64: company.logoBase64,
    } : null,
    shipment: shipment ? {
      shipmentNo: shipment.shipmentNo,
      soNo: shipment.soNo,
      vesselVoyage: shipment.vesselVoyage,
      shippingLine: shipment.shippingLine,
      customsClosingDate: shipment.customsClosingDate,
      soEtd: shipment.soEtd,
      soEta: shipment.soEta,
      containerYard: shipment.containerYard,
      placeOfReceipt: shipment.placeOfReceipt,
      portOfLoading: shipment.portOfLoading,
      portOfDischarge: shipment.portOfDischarge,
      warehouseInFrom: shipment.warehouseInFrom,
      warehouseInUntil: shipment.warehouseInUntil,
      forwarderName: shipment.forwarderName,
      forwarderContact: shipment.forwarderContact,
      // 麥頭只給該供應商相關單號的 Remark 區塊（依 PO 號與其連結 PI 號比對）
      shippingMarks: shipment.shippingMarks
        ? filterMarksForDocNos(
            shipment.shippingMarks,
            notice.items.flatMap(it => [it.po.poNo, it.po.slsPi?.piNo].filter((s): s is string => !!s)),
          )
        : null,
    } : null,
    packingRows,
  })
}
