import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { patiscoLogin, listProformaInvoices, getOrderDetail, getOrderProducts, listDeliveryOrders, getDeliveryOrderDetail } from '@/api/patisco/client'
import { neon } from '@neondatabase/serverless'

export async function GET(req: NextRequest) {
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
          (SELECT COUNT(*) FROM "SLS_Order") AS orders,
          (SELECT COUNT(*) FROM "SLS_PI") AS pis,
          (SELECT COUNT(*) FROM "SLS_Item") AS items,
          (SELECT COUNT(*) FROM "SYS_PatiscoSync") AS sync_records,
          (SELECT COUNT(*) FROM "SYS_PatiscoSync" WHERE status='ok') AS sync_ok,
          (SELECT COUNT(*) FROM "SYS_PatiscoSync" WHERE status='error') AS sync_error
      `
      const skus = await sql`SELECT id, sku, name, "patiscoProductId", "isActive" FROM "PRD_Product" ORDER BY id LIMIT 20`
      // Show which PI doc IDs are in SLS_PI and what patiscoDocId they used for getOrderDetail
      const piDocs = await sql`
        SELECT p."piNo", p."patiscoDocId",
               COUNT(si.id) AS "itemCount",
               string_agg(pr.sku, ',') AS "skus",
               string_agg(si.quantity::text, ',') AS "qtys"
        FROM "SLS_PI" p
        JOIN "SLS_Order" o ON o.id = p."orderId"
        LEFT JOIN "SLS_Item" si ON si."orderId" = o.id
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
      const items = (res.data?.items ?? []).slice(0, 5).map(d => ({ id: d.id, no: d.no, buyer: d.buyer }))
      return NextResponse.json({ ok: true, total: res.data?.items?.length, items })
    }

    if (action === 'getDODetail') {
      const doId = searchParams.get('doId') ?? ''
      const docType = (searchParams.get('docType') ?? 'commercialInvoice') as 'commercialInvoice' | 'packingList'
      const res = await getDeliveryOrderDetail(creds, doId, docType)
      return NextResponse.json({ ok: res.ok, error: !res.ok ? res.error : undefined, data: res.ok ? res.data : undefined })
    }

    // 補填所有缺 patiscoCreatedAt 的 SLS_Order（從 Patisco listProformaInvoices 拿 createdDate）
    if (action === 'backfillCreatedAt') {
      const missing = await prisma.sLS_Order.findMany({
        where: { patiscoCreatedAt: null, source: 'PATISCO', patiscoDocId: { not: null } },
        select: { id: true, orderNo: true, patiscoDocId: true },
      })
      if (missing.length === 0) return NextResponse.json({ ok: true, message: '無需補填', updated: 0 })

      // 從 Patisco 拉所有 PI 建立一個 docId → createdDate 的 map
      const piMap = new Map<string, string>()
      let page = 1
      while (true) {
        const res = await listProformaInvoices(creds, page)
        if (!res.ok || !res.data?.items?.length) break
        for (const pi of res.data.items) {
          if (pi.id && pi.createdDate) piMap.set(pi.id, pi.createdDate)
        }
        if (res.data.items.length < 20) break
        page++
      }

      function parseCreatedDate(cd: string): Date | null {
        if (!cd || cd.length < 8) return null
        const y  = parseInt(cd.substring(0,4), 10)
        const mo = parseInt(cd.substring(4,6), 10) - 1
        const d  = parseInt(cd.substring(6,8), 10)
        const h  = cd.length >= 10 ? parseInt(cd.substring(8,10), 10) : 0
        const mi = cd.length >= 12 ? parseInt(cd.substring(10,12), 10) : 0
        const s  = cd.length >= 14 ? parseInt(cd.substring(12,14), 10) : 0
        const dt = new Date(Date.UTC(y, mo, d, h, mi, s))
        return isNaN(dt.getTime()) ? null : dt
      }

      let updated = 0
      const results = []
      for (const order of missing) {
        const cd = piMap.get(order.patiscoDocId!)
        if (!cd) { results.push({ orderNo: order.orderNo, status: 'not found in Patisco' }); continue }
        const dt = parseCreatedDate(cd)
        if (!dt) { results.push({ orderNo: order.orderNo, status: 'invalid date: ' + cd }); continue }
        await prisma.sLS_Order.update({ where: { id: order.id }, data: { patiscoCreatedAt: dt } })
        updated++
        results.push({ orderNo: order.orderNo, status: 'ok', date: dt.toISOString() })
      }
      return NextResponse.json({ ok: true, missing: missing.length, updated, results })
    }

    return NextResponse.json({ error: 'unknown action' })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
