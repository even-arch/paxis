/**
 * POST /api/shipments/[id]/so-import
 * 上傳報關行的裝船通知單（SO / Shipping Order），AI 解析後套用到出貨單。
 * 支援 docx / pdf / xlsx / csv / 圖片。
 * 解析出的船務資料（S/O 號、船名航次、結關日、貨櫃場、進倉期限等）
 * 會寫入 SLS，供出貨通知單自動帶出交貨地點與期限。
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import { decrypt } from '@/lib/crypto'
import { callLLM, buildMessagesForFile, parseJsonResponse } from '@/lib/ai-llm'

type Params = { params: { id: string } }

interface ParsedSO {
  soNo?: string | null
  vesselVoyage?: string | null
  shippingLine?: string | null
  customsClosingDate?: string | null
  etd?: string | null
  eta?: string | null
  containerYard?: string | null
  placeOfReceipt?: string | null
  portOfLoading?: string | null
  portOfDischarge?: string | null
  warehouseInFrom?: string | null
  warehouseInUntil?: string | null
  forwarderName?: string | null
  forwarderContact?: string | null
  notes?: string | null
}

const SYSTEM_PROMPT = `你是專業的海運出口文件解析助理，負責從報關行/Forwarder 發出的「裝船通知單（Shipping Order / SO）」中提取船務資訊。

請解析文件內容，提取以下資訊並回傳 JSON：
{
  "soNo": "S/O 號碼（如 S312）",
  "vesselVoyage": "船名/航次（如 YM TOPMOST 025W）",
  "shippingLine": "船公司（如 陽明(YML)）",
  "customsClosingDate": "結關日（ISO 格式 YYYY-MM-DD）",
  "etd": "預計開船日 ETD（YYYY-MM-DD）",
  "eta": "預計到港日 ETA（YYYY-MM-DD）",
  "containerYard": "貨櫃場（如 桃園長榮 5 庫）",
  "placeOfReceipt": "收貨地（如 KEELUNG）",
  "portOfLoading": "裝貨港（如 KAOHSIUNG）",
  "portOfDischarge": "卸貨港（如 ROTTERDAM）",
  "warehouseInFrom": "最早進倉日（YYYY-MM-DD）",
  "warehouseInUntil": "最晚進倉期限（YYYY-MM-DD；如「最晚 7/15 中午前進倉」取該日期）",
  "forwarderName": "Forwarder / 報關行公司名稱",
  "forwarderContact": "Forwarder 聯絡資訊（電話、Email、聯絡人，合併為一行）",
  "notes": "注意事項重點摘要（包裝要求、HS CODE 要求等，條列合併為一段文字）"
}

注意：
- 文件上的日期常只有月/日（如 7/14），請根據文件日期或上下文推斷年份，輸出完整 YYYY-MM-DD
- 找不到的欄位填 null，不要猜測
- 只回傳 JSON，不加其他說明`

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/**
 * DELETE /api/shipments/[id]/so-import
 * 清空此出貨單的船務資訊（SO），供重新匯入。
 * 注意：portOfLoading / portOfDischarge 屬「出貨資訊」，可能來自 Patisco
 * 或手動輸入，SO 匯入只是覆蓋它們，清空時不動。
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = Number(params.id)
  if (isNaN(shipmentId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const shipment = await prisma.sLS.findUnique({ where: { id: shipmentId }, select: { id: true } })
  if (!shipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.sLS.update({
    where: { id: shipmentId },
    data: {
      soNo: null,
      vesselVoyage: null,
      shippingLine: null,
      containerYard: null,
      placeOfReceipt: null,
      forwarderName: null,
      forwarderContact: null,
      soNote: null,
      customsClosingDate: null,
      soEtd: null,
      soEta: null,
      warehouseInFrom: null,
      warehouseInUntil: null,
    },
  })

  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipmentId = Number(params.id)
  if (isNaN(shipmentId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const shipment = await prisma.sLS.findUnique({ where: { id: shipmentId }, select: { id: true } })
  if (!shipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 取 AI 設定（與其他 AI 解析端點一致）
  const user = await prisma.sYS_User.findFirst({
    where: { loginId: session.user.email ?? '' },
    select: { aiProvider: true, encryptedAiKey: true, aiParseModel: true },
  })
  const aiProvider = user?.aiProvider ?? 'anthropic'
  const apiKey = user?.encryptedAiKey ? decrypt(user.encryptedAiKey) : (
    aiProvider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY
  ) ?? ''
  const model = user?.aiParseModel ?? (aiProvider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini')

  if (!apiKey) {
    return NextResponse.json({ error: '請先在「設定 → AI 功能」設定 AI API Key' }, { status: 400 })
  }

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: '請上傳 SO 檔案' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const messages = await buildMessagesForFile(
      buffer, file.type, file.name,
      SYSTEM_PROMPT, '請解析這份裝船通知單（SO），回傳 JSON。', aiProvider,
    )

    const raw = await callLLM(aiProvider, apiKey, model, messages, 2048)
    const parsed = parseJsonResponse<ParsedSO>(raw)

    // 套用到出貨單（只覆蓋有解析到的欄位）
    const data: Record<string, unknown> = {}
    if (parsed.soNo) data.soNo = parsed.soNo
    if (parsed.vesselVoyage) data.vesselVoyage = parsed.vesselVoyage
    if (parsed.shippingLine) data.shippingLine = parsed.shippingLine
    if (parsed.containerYard) data.containerYard = parsed.containerYard
    if (parsed.placeOfReceipt) data.placeOfReceipt = parsed.placeOfReceipt
    if (parsed.portOfLoading) data.portOfLoading = parsed.portOfLoading
    if (parsed.portOfDischarge) data.portOfDischarge = parsed.portOfDischarge
    if (parsed.forwarderName) data.forwarderName = parsed.forwarderName
    if (parsed.forwarderContact) data.forwarderContact = parsed.forwarderContact
    if (parsed.notes) data.soNote = parsed.notes
    const closing = parseDate(parsed.customsClosingDate)
    if (closing) data.customsClosingDate = closing
    const etd = parseDate(parsed.etd)
    if (etd) data.soEtd = etd
    const eta = parseDate(parsed.eta)
    if (eta) data.soEta = eta
    const whFrom = parseDate(parsed.warehouseInFrom)
    if (whFrom) data.warehouseInFrom = whFrom
    const whUntil = parseDate(parsed.warehouseInUntil)
    if (whUntil) data.warehouseInUntil = whUntil

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'AI 沒有解析出任何船務欄位，請確認檔案內容' }, { status: 422 })
    }

    const updated = await prisma.sLS.update({ where: { id: shipmentId }, data })

    // 同步更新此出貨單既有通知單（草稿）的交貨地點與期望到貨日
    if (parsed.containerYard) {
      await prisma.pO_ShippingNotice.updateMany({
        where: { sourceShipmentId: shipmentId, status: 'DRAFT', deliverToName: null },
        data: { deliverToName: parsed.containerYard },
      })
    }
    if (whUntil) {
      await prisma.pO_ShippingNotice.updateMany({
        where: { sourceShipmentId: shipmentId, status: 'DRAFT', expectedDeliveryDate: null },
        data: { expectedDeliveryDate: whUntil },
      })
    }

    return NextResponse.json({ ok: true, applied: data, parsed })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `解析失敗：${msg}` }, { status: 500 })
  }
}
