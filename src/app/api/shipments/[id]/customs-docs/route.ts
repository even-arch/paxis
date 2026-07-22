/**
 * GET  /api/shipments/[id]/customs-docs  — 列出已歸檔文件 + 三方勾稽 + 建議動作
 * POST /api/shipments/[id]/customs-docs  — 上傳文件（可多檔），AI 解析後歸檔
 *
 * 純歸檔 + 建議：解析結果不會自動寫入其他業務資料表，
 * 「套用」動作在 apply/route.ts，且都需人工在畫面上按確認。
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { decrypt } from '@/lib/crypto'
import { callLLM, buildMessagesForFile, parseJsonResponse } from '@/lib/ai-llm'
import { buildCustomsDocPrompt, type ParsedCustomsDoc, type CustomsDocType } from '@/lib/customs-doc-ai'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = Number(params.id)
  if (isNaN(shipmentId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const docs = await prisma.sLS_CustomsDoc.findMany({
    where: { shipmentId },
    select: {
      id: true, docType: true, fileName: true, mimeType: true,
      parsedResult: true, parseError: true, uploadedAt: true,
      uploader: { select: { name: true } },
    },
    orderBy: { uploadedAt: 'desc' },
  })

  // ── 三方勾稽：出口報單 vs 商業發票 vs 系統內 PI 總額 ──────────────────
  const parsedDocs = docs
    .filter(d => d.parsedResult)
    .map(d => ({ id: d.id, ...(d.parsedResult as unknown as ParsedCustomsDoc) }))

  const customsDecl = parsedDocs.find(d => d.docType === 'CUSTOMS_DECLARATION')
  const commercialInv = parsedDocs.find(d => d.docType === 'COMMERCIAL_INVOICE')

  const piLinks = await prisma.sLS_PI_Link.findMany({
    where: { shipmentId },
    select: { pi: { select: { totalAmount: true, currencyCode: true, piNo: true } } },
  })
  const piCurrency = piLinks[0]?.pi.currencyCode ?? null
  const piTotal = piLinks.reduce((sum, l) => sum + Number(l.pi.totalAmount ?? 0), 0)

  const flags: Array<{ message: string; severity: 'warn' | 'info' }> = []
  const TOLERANCE = 0.02 // 容許 2% 誤差（匯率換算、四捨五入）

  function compare(aLabel: string, a: number | null | undefined, bLabel: string, b: number | null | undefined) {
    if (a == null || b == null || a === 0) return
    const diff = Math.abs(a - b) / a
    if (diff > TOLERANCE) {
      flags.push({
        severity: 'warn',
        message: `${aLabel}（${a.toLocaleString()}）與${bLabel}（${b.toLocaleString()}）差異 ${(diff * 100).toFixed(1)}%，建議核對`,
      })
    }
  }

  // 只在幣別相同時才比對金額——PI 常以 TWD 記錄，商業發票/出口報單原幣多為 EUR，
  // 不同幣別直接相減會產生誤導性的假警報；改用「完稅價格(TWD)」與 PI(TWD) 對比。
  if (customsDecl?.currency && commercialInv?.currency && customsDecl.currency === commercialInv.currency) {
    compare('出口報單金額', customsDecl.totalAmount ?? null, '商業發票金額', commercialInv.totalAmount ?? null)
  }
  if (piCurrency === 'TWD' && customsDecl?.totalAmountTWD != null && piTotal > 0) {
    compare('出口報單完稅價格(TWD)', customsDecl.totalAmountTWD, '系統內 PI 總額(TWD)', piTotal)
  }
  if (piCurrency && commercialInv?.currency && piCurrency === commercialInv.currency && piTotal > 0) {
    compare('商業發票金額', commercialInv.totalAmount ?? null, '系統內 PI 總額', piTotal)
  }

  // ── 建議：HTS Code 回填（出口報單的稅則號別 → 缺漏的 PRD_Product.htsCode）──
  const htsBackfill: Array<{ productId: number; sku: string; productName: string; currentHtsCode: string | null; suggestedHtsCode: string }> = []
  if (customsDecl?.lineItems) {
    const skus = customsDecl.lineItems.map(li => li.sku).filter((s): s is string => !!s)
    if (skus.length > 0) {
      const products = await prisma.pRD_Product.findMany({
        where: { sku: { in: skus } },
        select: { id: true, sku: true, name: true, htsCode: true },
      })
      const bySku = new Map(products.map(p => [p.sku, p]))
      for (const li of customsDecl.lineItems) {
        if (!li.sku || !li.htsCode) continue
        const product = bySku.get(li.sku)
        if (!product) continue
        if (product.htsCode?.trim()) continue // 已有值，不覆蓋
        if (htsBackfill.some(h => h.productId === product.id)) continue // 同 SKU 只建議一次
        htsBackfill.push({
          productId: product.id, sku: li.sku, productName: product.name,
          currentHtsCode: product.htsCode, suggestedHtsCode: li.htsCode,
        })
      }
    }
  }

  // ── 建議：貨代費用項目（避免對已套用過的重複建議）───────────────────
  const freightItemSuggestions: Array<{ docId: number; name: string; amountTWD: number; note?: string | null }> = []
  const forwarderDocs = parsedDocs.filter(d => d.docType === 'FORWARDER_INVOICE' && d.freightItems?.length)
  if (forwarderDocs.length > 0) {
    const existingItems = await prisma.sLS_FobCostItem.findMany({
      where: { shipmentId },
      select: { name: true, amountTWD: true },
    })
    const existingKey = (name: string, amt: number) => `${name}|${amt}`
    const existingSet = new Set(existingItems.map(i => existingKey(i.name, Number(i.amountTWD))))
    for (const doc of forwarderDocs) {
      for (const item of doc.freightItems ?? []) {
        if (existingSet.has(existingKey(item.name, item.amountTWD))) continue
        freightItemSuggestions.push({ docId: doc.id, name: item.name, amountTWD: item.amountTWD, note: item.note })
      }
    }
  }

  // ── 保稅工廠合規提醒（去重）─────────────────────────────────────────
  const bondedWarnings = Array.from(new Set(
    parsedDocs.map(d => d.bondedFactoryWarning).filter((s): s is string => !!s)
  ))

  return NextResponse.json({
    docs,
    reconciliation: {
      piTotal: piTotal > 0 ? { amount: piTotal, currency: piCurrency } : null,
      commercialInvoiceTotal: commercialInv?.totalAmount != null
        ? { amount: commercialInv.totalAmount, currency: commercialInv.currency } : null,
      customsDeclaredTotal: customsDecl?.totalAmount != null
        ? { amount: customsDecl.totalAmount, currency: customsDecl.currency } : null,
      customsDeclaredTWD: customsDecl?.totalAmountTWD ?? null,
      flags,
    },
    suggestions: {
      htsBackfill,
      freightItems: freightItemSuggestions,
      bondedWarnings,
    },
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = Number(params.id)
  if (isNaN(shipmentId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const shipment = await prisma.sLS.findUnique({ where: { id: shipmentId }, select: { id: true } })
  if (!shipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const user = await prisma.sYS_User.findFirst({
    where: { loginId: session.user.email ?? '' },
    select: { id: true, aiProvider: true, encryptedAiKey: true, aiParseModel: true },
  })
  const aiProvider = user?.aiProvider ?? 'anthropic'
  const apiKey = user?.encryptedAiKey ? decrypt(user.encryptedAiKey) : (
    aiProvider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY
  ) ?? ''
  const model = user?.aiParseModel ?? (aiProvider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini')

  if (!apiKey) {
    return NextResponse.json({ error: '請先在「設定 → AI 功能」設定 AI API Key' }, { status: 400 })
  }

  const form = await req.formData()
  const files = form.getAll('files') as File[]
  if (files.length === 0) return NextResponse.json({ error: '請上傳至少一個檔案' }, { status: 400 })

  const { systemPrompt, userPrompt } = buildCustomsDocPrompt()
  const results: Array<{ id: number; fileName: string; docType: string; ok: boolean; error?: string }> = []

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer())
    const fileBase64 = buffer.toString('base64')

    try {
      const messages = await buildMessagesForFile(buffer, file.type, file.name, systemPrompt, userPrompt, aiProvider)
      const raw = await callLLM(aiProvider, apiKey, model, messages, 4096)
      const parsed = parseJsonResponse<ParsedCustomsDoc>(raw)
      const docType: CustomsDocType = parsed.docType ?? 'OTHER'

      const doc = await prisma.sLS_CustomsDoc.create({
        data: {
          shipmentId,
          docType,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileBase64,
          parsedResult: parsed as unknown as object,
          uploadedBy: user?.id ?? null,
        },
        select: { id: true },
      })
      results.push({ id: doc.id, fileName: file.name, docType, ok: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const doc = await prisma.sLS_CustomsDoc.create({
        data: {
          shipmentId,
          docType: 'OTHER',
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileBase64,
          parseError: msg,
          uploadedBy: user?.id ?? null,
        },
        select: { id: true },
      })
      results.push({ id: doc.id, fileName: file.name, docType: 'OTHER', ok: false, error: msg })
    }
  }

  return NextResponse.json({ results })
}
