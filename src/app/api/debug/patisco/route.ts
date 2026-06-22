import { NextRequest, NextResponse } from 'next/server'
import { getRequestPrisma } from '@/lib/request-db'
import { patiscoLogin, listProformaInvoices, getOrderDetail, getOrderProducts, listDeliveryOrders, getDeliveryOrderDetail } from '@/api/patisco/client'
import { neon } from '@neondatabase/serverless'

export async function GET(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') ?? 'listPIs'

  try {
    const creds = await patiscoLogin(prisma)
    if (!creds) return NextResponse.json({ error: 'login failed' }, { status: 500 })

    if (action === 'listPIs') {
      // Show first page of PIs with their id, no, and Products count
      const res = await listProformaInvoices(creds, 1)
      if (!res.ok) return NextResponse.json({ error: res.error })
      const items = res.data?.items?.slice(0, 5).map(pi => ({
        id: pi.id,
        no: pi.no,
        productsInList: pi.Products?.length ?? 0,
        firstProductSKU: pi.Products?.[0]?.SKU ?? null,
      }))
      return NextResponse.json({ ok: true, total: res.data?.items?.length, items })
    }

    if (action === 'getOrderDetail') {
      const orderId = searchParams.get('orderId') ?? ''
      const res = await getOrderDetail(creds, orderId)
      return NextResponse.json({ ok: res.ok, error: !res.ok ? res.error : undefined, data: res.ok ? res.data : undefined })
    }

    if (action === 'dbStats') {
      const sql = neon(process.env.DATABASE_URL!)
      const rows = await sql`
        SELECT
          (SELECT COUNT(*) FROM "PRD_Product") AS products,
          (SELECT COUNT(*) FROM "PO_CustomerCopy") AS orders,
          (SELECT COUNT(*) FROM "PI") AS pis,
          (SELECT COUNT(*) FROM "PO_CustomerCopy_Item") AS items,
          (SELECT COUNT(*) FROM "SYS_PatiscoSync") AS sync_records,
          (SELECT COUNT(*) FROM "SYS_PatiscoSync" WHERE status='ok') AS sync_ok,
          (SELECT COUNT(*) FROM "SYS_PatiscoSync" WHERE status='error') AS sync_error
      `
      const skus = await sql`SELECT id, sku, name, "patiscoProductId", "isActive" FROM "PRD_Product" ORDER BY id LIMIT 20`
      // Show which PI doc IDs are in PI and what patiscoDocId they used for getOrderDetail
      const piDocs = await sql`
        SELECT p."piNo", p."patiscoDocId",
               COUNT(si.id) AS "itemCount",
               string_agg(pr.sku, ',') AS "skus",
               string_agg(si.quantity::text, ',') AS "qtys"
        FROM "PI" p
        JOIN "PO_CustomerCopy" o ON o.id = p."orderId"
        LEFT JOIN "PO_CustomerCopy_Item" si ON si."orderId" = o.id
        LEFT JOIN "PRD_Product" pr ON pr.id = si."productId"
        GROUP BY p."piNo", p."patiscoDocId"
        LIMIT 20
      `
      // Also show sync records to see what pi.id was used
      const syncRecs = await sql`
        SELECT "patiscoDocId", "patiscoDocNo", status
        FROM "SYS_PatiscoSync"
        WHERE "docType" = 'PI' AND status = 'ok'
        LIMIT 20
      `
      return NextResponse.json({ stats: rows[0], products: skus, piDocs, syncRecs })
    }

    if (action === 'tracePI') {
      // 模擬 sync 的完整路徑
      const piNo = searchParams.get('piNo') ?? 'E2620097'
      // 從 listProformaInvoices 找這個 PI
      const listRes = await listProformaInvoices(creds, 1)
      const allItems = listRes.ok ? (listRes.data?.items ?? []) : []
      const pi = allItems.find(p => p.no === piNo) ?? allItems[0]
      if (!pi) return NextResponse.json({ error: `PI ${piNo} not found in list` })

      // 完全照 sync 的路徑
      const detailRes = await getOrderDetail(creds, pi.id)
      let detailItems: unknown[] = []
      if (detailRes.ok && detailRes.data?.products?.items) {
        detailItems = detailRes.data.products.items
      }

      // fallback
      let fallbackItems: unknown[] = []
      let fallbackOrders: unknown[] = []
      if (detailItems.length === 0) {
        const prodRes = await getOrderProducts(creds, pi.id)
        if (prodRes.ok) {
          fallbackItems = prodRes.data?.items ?? []
          fallbackOrders = prodRes.data?.orders ?? []
        }
      }

      return NextResponse.json({
        pi: { id: pi.id, no: pi.no },
        detailOk: detailRes.ok,
        detailError: !detailRes.ok ? detailRes.error : undefined,
        detailRawKeys: detailRes.ok ? Object.keys(detailRes.data ?? {}) : undefined,
        detailProductsCount: detailItems.length,
        detailProducts: detailItems.slice(0, 3),
        usedFallback: detailItems.length === 0,
        fallbackNewItems: fallbackItems.length,
        fallbackOldOrders: fallbackOrders.length,
        fallbackFirstProduct: (fallbackOrders as { Products?: { SKU?: string }[] }[])[0]?.Products?.[0]?.SKU ?? null,
      })
    }

    if (action === 'listDOs') {
      const res = await listDeliveryOrders(creds, 1)
      if (!res.ok) return NextResponse.json({ error: res.error })
      // 回傳完整欄位，讓我們看到 copyId
      const items = (res.data?.items ?? []).slice(0, 5).map(d => ({
        id: d.id, no: d.no, buyer: d.buyer, copyId: d.copyId,
        createdDate: d.createdDate, expiredDate: d.expiredDate,
      }))
      return NextResponse.json({ ok: true, total: res.data?.items?.length, items })
    }

    if (action === 'getDODetail') {
      const doId = searchParams.get('doId') ?? ''
      const docType = (searchParams.get('docType') ?? 'commercialInvoice') as 'commercialInvoice' | 'packingList'
      const res = await getDeliveryOrderDetail(creds, doId, docType)
      return NextResponse.json({ ok: res.ok, error: !res.ok ? res.error : undefined, data: res.ok ? res.data : undefined })
    }

    // 同時用 id 和 copyId 測試，找出哪個能拿到資料
    if (action === 'probeDO') {
      const doId = searchParams.get('doId') ?? ''
      const copyId = searchParams.get('copyId') ?? ''
      const [r1, r2, r3, r4] = await Promise.all([
        getDeliveryOrderDetail(creds, doId, 'commercialInvoice'),
        getDeliveryOrderDetail(creds, doId, 'packingList'),
        copyId ? getDeliveryOrderDetail(creds, copyId, 'commercialInvoice') : Promise.resolve({ ok: false, error: 'no copyId' }),
        copyId ? getDeliveryOrderDetail(creds, copyId, 'packingList') : Promise.resolve({ ok: false, error: 'no copyId' }),
      ])
      return NextResponse.json({
        withId: {
          ci: { ok: r1.ok, keys: r1.ok ? Object.keys(r1.data ?? {}) : null, error: !r1.ok ? (r1 as {error?:string}).error : undefined, sample: r1.ok ? JSON.stringify(r1.data).slice(0, 300) : null },
          pl: { ok: r2.ok, keys: r2.ok ? Object.keys(r2.data ?? {}) : null, error: !r2.ok ? (r2 as {error?:string}).error : undefined },
        },
        withCopyId: copyId ? {
          ci: { ok: r3.ok, keys: r3.ok ? Object.keys((r3 as {data?: unknown}).data ?? {}) : null, error: !r3.ok ? (r3 as {error?:string}).error : undefined, sample: r3.ok ? JSON.stringify((r3 as {data?: unknown}).data).slice(0, 300) : null },
          pl: { ok: r4.ok, keys: r4.ok ? Object.keys((r4 as {data?: unknown}).data ?? {}) : null, error: !r4.ok ? (r4 as {error?:string}).error : undefined },
        } : 'skipped (no copyId)',
      })
    }

    // 將缺 patiscoCreatedAt 的 PO_CustomerCopy 對應的 SYS_PatiscoSync 重設為 pending，讓下次 sync 重新處理
    if (action === 'backfillCreatedAt') {
      const sql = neon(process.env.DATABASE_URL!)
      const missing = await prisma.pO_CustomerCopy.findMany({
        where: { patiscoCreatedAt: null, source: 'PATISCO', patiscoDocId: { not: null } },
        select: { id: true, orderNo: true, patiscoDocId: true },
      })
      if (missing.length === 0) return NextResponse.json({ ok: true, message: '無需補填', reset: 0 })

      const docIds = missing.map(o => o.patiscoDocId!)
      await sql`
        UPDATE "SYS_PatiscoSync"
        SET status = 'pending'
        WHERE "patiscoDocId" = ANY(${docIds}::text[]) AND "docType" = 'PI'
      `
      return NextResponse.json({
        ok: true,
        missing: missing.length,
        reset: docIds.length,
        message: '請再跑一次 Patisco 同步，日期將自動補填',
        orders: missing.map(o => o.orderNo),
      })
    }

    // 將缺 etd 的 PI 對應的 SYS_PatiscoSync 重設為 pending，讓下次 sync 補填 ETD
    if (action === 'backfillEtd') {
      const sql = neon(process.env.DATABASE_URL!)
      const missing = await prisma.pI.findMany({
        where: { etd: null, source: 'PATISCO', patiscoDocId: { not: null } },
        select: { id: true, piNo: true, patiscoDocId: true },
      })
      if (missing.length === 0) return NextResponse.json({ ok: true, message: '無需補填', reset: 0 })

      const docIds = missing.map(p => p.patiscoDocId!)
      await sql`
        UPDATE "SYS_PatiscoSync"
        SET status = 'pending'
        WHERE "patiscoDocId" = ANY(${docIds}::text[]) AND "docType" = 'PI'
      `
      return NextResponse.json({
        ok: true,
        missing: missing.length,
        reset: docIds.length,
        message: '請再跑一次 Patisco 同步，ETD 將自動補填',
        pis: missing.map(p => p.piNo),
      })
    }

    // 診斷某出貨單的 PI 連結狀況
    // ?action=diagShipment&shipmentNo=A251217
    if (action === 'diagShipment') {
      const shipmentNo = searchParams.get('shipmentNo') ?? ''
      if (!shipmentNo) return NextResponse.json({ error: 'shipmentNo required' })

      const sql = neon(process.env.DATABASE_URL!)

      // 1. PAXIS 裡的出貨單
      const shipments = await sql`
        SELECT s.id, s."shipmentNo", s."patiscoDocId", s."patiscoDocNo",
               s."ciExchangeRate", s."currencyCode", s."actualShipDate",
               r."amountForeign", r."amountTWD", r.status as ar_status
        FROM "SLS" s
        LEFT JOIN "FIN_Receivable" r ON r."shipmentId" = s.id
        WHERE s."shipmentNo" = ${shipmentNo}
      `
      if (shipments.length === 0) return NextResponse.json({ error: `Shipment ${shipmentNo} not found` })
      const sls = shipments[0]

      // 2. 目前連結的 PI
      const linkedPIs = await sql`
        SELECT pi."piNo", pi."patiscoDocId", pi."totalAmount", pi."currencyCode",
               pi."orderId",
               (SELECT COUNT(*) FROM "SLS_Item" WHERE "shipmentId" = ${sls.id} AND "piId" = pi.id) as item_count
        FROM "SLS_PI_Link" l
        JOIN "PI" pi ON pi.id = l."piId"
        WHERE l."shipmentId" = ${sls.id}
        ORDER BY pi."piNo"
      `

      // 3. AP payables
      const payables = await sql`
        SELECT p.id, p."amountTWD", p.status, p."paidAmountTWD",
               po."poNo", po."totalAmount" as po_total,
               sup."shortName" as supplier
        FROM "FIN_Payable" p
        LEFT JOIN "PO" po ON po.id = p."poId"
        LEFT JOIN "SUP_Supplier" sup ON sup.id = p."supplierId"
        WHERE p."shipmentId" = ${sls.id}
      `

      // 4. SYS_PatiscoSync 原始記錄（找出這個 DO 的 sync 記錄）
      const syncRecs = await sql`
        SELECT "patiscoDocId", "patiscoDocNo", "docType", status, "syncedAt"
        FROM "SYS_PatiscoSync"
        WHERE "patiscoDocNo" = ${shipmentNo} OR "patiscoDocId" = ${sls.patiscoDocId ?? ''}
        ORDER BY "syncedAt" DESC
        LIMIT 5
      `

      // 5. 嘗試從 Patisco 拉最新 DO 資料（若有 patiscoDocId）
      let patiscoData = null
      if (sls.patiscoDocId) {
        const [ciRes, plRes] = await Promise.all([
          getDeliveryOrderDetail(creds, String(sls.patiscoDocId), 'commercialInvoice'),
          getDeliveryOrderDetail(creds, String(sls.patiscoDocId), 'packingList'),
        ])
        // getDeliveryOrderDetail 回傳格式：{ commercialInvoice: PatiscoShipmentDetail } 或 { packingList: ... }
        type DOWrapper = { commercialInvoice?: { orders?: { no?: string }[]; total?: { amount?: string; totalPriceOfProducts?: string; additionalCharges?: string }; extraCharges?: unknown[] }; packingList?: { orders?: { no?: string }[] } }
        const ciData = ciRes.ok ? (ciRes.data as DOWrapper) : null
        const plData = plRes.ok ? (plRes.data as DOWrapper) : null
        const ciOrders = ciData?.commercialInvoice?.orders?.map((o) => o.no) ?? null
        const plOrders = plData?.packingList?.orders?.map((o) => o.no) ?? null
        const ciTotal = ciData?.commercialInvoice?.total ?? null
        const ciExtraCharges = ciData?.commercialInvoice?.extraCharges ?? null
        patiscoData = {
          ci: { ok: ciRes.ok, orders: ciOrders, total: ciTotal, extraCharges: ciExtraCharges, rawKeys: ciData ? Object.keys(ciData) : [] },
          pl: { ok: plRes.ok, orders: plOrders },
        }
      }

      return NextResponse.json({
        shipment: sls,
        linkedPIs,
        payables,
        syncRecords: syncRecs,
        patiscoLive: patiscoData,
      })
    }

    // 顯示某出貨單的 SLS_Item 列表，含 piId、rawSku 以診斷 item-level 計算
    // ?action=diagItems&shipmentNo=A251217
    if (action === 'diagItems') {
      const shipmentNo = searchParams.get('shipmentNo') ?? ''
      if (!shipmentNo) return NextResponse.json({ error: 'shipmentNo required' })
      const sql = neon(process.env.DATABASE_URL!)

      // 1. 每個品項的 rawSku, piId, piNo
      const items = await sql`
        SELECT si.id, si."rawSku", si."rawProductName", si.quantity, si."unitPrice", si."piId",
               pi."piNo", pi."orderId"
        FROM "SLS_Item" si
        JOIN "SLS" s ON s.id = si."shipmentId"
        LEFT JOIN "PI" pi ON pi.id = si."piId"
        WHERE s."shipmentNo" = ${shipmentNo}
        ORDER BY si."piId" NULLS LAST, si."rawSku"
      `

      // 2. 每個 piId 下的 PI_Item（供應商報價）
      const piIds = Array.from(new Set(items.filter(r => r.piId).map(r => r.piId as number)))
      const piItems = piIds.length > 0 ? await sql`
        SELECT pi_item.id, pi_item."piId", pi_item.quantity, pi_item."unitPrice", pi_item."unit",
               pp.sku, pp.name
        FROM "PI_Item" pi_item
        JOIN "PI" pi ON pi.id = pi_item."piId"
        LEFT JOIN "SLS_Item" sls_i ON sls_i.id = pi_item."slsItemId"
        LEFT JOIN "PRD_Product" pp ON pp.id = sls_i."productId"
        WHERE pi_item."piId" = ANY(${piIds})
        ORDER BY pi_item."piId", pp.sku
      ` : []

      // 3. 每個 piId → PO 的 totalAmount / exchangeRate
      const poInfo = piIds.length > 0 ? await sql`
        SELECT pi.id AS pi_id, pi."piNo", po."poNo", po."totalAmount", po."exchangeRate", po."currencyCode"
        FROM "PI" pi
        LEFT JOIN "PO" po ON po.id = pi."orderId"
        WHERE pi.id = ANY(${piIds})
      ` : []

      return NextResponse.json({ items, piItems, poInfo })
    }

    // 直接設定某筆 payable 的 amountTWD
    // ?action=setPayable&id=83&amount=25556
    if (action === 'setPayable') {
      const id = parseInt(searchParams.get('id') ?? '0')
      const amount = parseFloat(searchParams.get('amount') ?? '0')
      if (!id || !amount) return NextResponse.json({ error: 'id and amount required' })
      const sql = neon(process.env.DATABASE_URL!)
      const rows = await sql`
        UPDATE "FIN_Payable"
        SET "amountTWD" = ${amount}
        WHERE id = ${id}
        RETURNING id, "amountTWD"
      `
      return NextResponse.json({ ok: true, rows })
    }

    // 修正某出貨單的 payable amountTWD：從連結 PO 的 totalAmount 重新計算
    // （注意：只適用於整張 PI 只出一次貨的情況；分箱出貨必須用 item-level 計算）
    // ?action=fixPayables&shipmentNo=A251217
    if (action === 'fixPayables') {
      const shipmentNo = searchParams.get('shipmentNo') ?? ''
      if (!shipmentNo) return NextResponse.json({ error: 'shipmentNo required' })
      const sql = neon(process.env.DATABASE_URL!)

      const rows = await sql`
        UPDATE "FIN_Payable"
        SET "amountTWD" = po."totalAmount" * COALESCE(po."exchangeRate", 1),
            "supplierId" = po."supplierId"
        FROM "SLS" s, "PO" po
        WHERE "FIN_Payable"."shipmentId" = s.id
          AND "FIN_Payable"."poId" = po.id
          AND s."shipmentNo" = ${shipmentNo}
          AND po."totalAmount" IS NOT NULL
          AND po."totalAmount" > 0
        RETURNING "FIN_Payable".id, "FIN_Payable"."amountTWD", "FIN_Payable"."supplierId", po."poNo"
      `
      return NextResponse.json({ ok: true, updated: rows.length, rows })
    }

    return NextResponse.json({ error: 'unknown action' })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
