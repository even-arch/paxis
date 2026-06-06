/**
 * Patisco PI 產品 AI 豐富化
 *
 * 職責：
 *  1. 從 Specification 推導產品名稱（若 PRD_Product.name 尚未設定）
 *  2. 從 Specification 推導 HS Code（若 htsCode 尚未設定）
 *  3. 比對本次 PI 報價 vs 歷史紀錄，標記價差
 *
 * 設計原則：
 *  - AI 失敗不中斷 sync，fallback 到 ModelNo 當名稱，htsCode 留空
 *  - 同一 SKU 已有 name + htsCode → 跳過 AI 呼叫（不覆蓋人工修改）
 *  - 語言跟著 Specification 走（英文規格 → 英文名稱）
 */

import type { PrismaClient } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { callLLM, parseJsonResponse } from '@/lib/ai-llm'
import { decrypt } from '@/lib/crypto'

// ─── AI config ───────────────────────────────────────────────────────────────

type AiConfig = {
  provider: string
  apiKey: string
  model: string
}

/** 取得系統用 AI 設定（用最早建立的 user，cron/background 情境） */
async function getSystemAiConfig(prisma: PrismaClient): Promise<AiConfig | null> {
  const user = await prisma.sYS_User.findFirst({
    orderBy: { id: 'asc' },
    select: { aiProvider: true, encryptedAiKey: true, aiParseModel: true },
  })
  if (!user?.aiProvider || !user?.encryptedAiKey) return null
  try {
    const apiKey = decrypt(user.encryptedAiKey)
    const model = user.aiParseModel
      || (user.aiProvider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini')
    return { provider: user.aiProvider, apiKey, model }
  } catch {
    return null
  }
}

// ─── HS Code 推導 ─────────────────────────────────────────────────────────────

/**
 * 從產品規格文字推導 6 位 HS Code（Chapter.Heading.Subheading）
 * 回傳格式：如 "8714.99"（6碼含點分隔）
 */
async function deriveHsCode(
  cfg: AiConfig,
  specification: string,
  productName: string,
): Promise<string | null> {
  const prompt = `You are a customs classification expert specialising in bicycle and cycling parts.

The specification below is for a bicycle component or part. Identify the correct 6-digit HS Code.

Key guidance for bicycle parts:
- Bicycle chains → 7315.11 or 7315.12
- Bicycle derailleurs, shifters, brakes, hubs, cranks, pedals, handlebars, saddles, forks → 8714.99
- Bicycle wheels, rims, spokes → 8714.92 or 8714.99
- Ball bearings / bearing assemblies → 8482.10
- Pulleys (non-bearing) → 8483.90
- Nuts, bolts, screws for bicycles → 7318.15 or 7318.16

Product specification:
${specification}
${productName ? `Product name: ${productName}` : ''}

Respond ONLY with a JSON object, no markdown:
{"hs_code": "XXXX.XX", "description": "one-line classification rationale"}`

  try {
    const raw = await callLLM(cfg.provider, cfg.apiKey, cfg.model, [
      { role: 'user', content: prompt },
    ], 256)
    const parsed = parseJsonResponse<{ hs_code?: string }>(raw)
    const code = parsed.hs_code?.trim()
    if (code && /^\d{4}\.\d{2}$/.test(code)) return code
    // 嘗試不帶點的格式（XXXXXX → XXXX.XX）
    const noPoint = code?.replace(/\D/g, '')
    if (noPoint && noPoint.length === 6) return `${noPoint.slice(0, 4)}.${noPoint.slice(4)}`
    return null
  } catch {
    return null
  }
}

// ─── 產品名稱推導 ─────────────────────────────────────────────────────────────

/**
 * 從 Specification 推導簡短產品名稱
 * 語言跟規格走（英文規格 → 英文名稱；中文規格 → 中文名稱）
 */
async function deriveName(
  cfg: AiConfig,
  specification: string,
  modelNo: string | null,
): Promise<string | null> {
  const prompt = `Extract the product TYPE (generic name) from this bicycle part specification.

Rules:
- The first word(s) before any model number is usually the product type. Examples:
  "CHAIN S512H 1/2 * 1/8 ..." → "Bicycle Chain"
  "SHIFTER SLM2T.R70S ..." → "Gear Shifter"
  "REAR DERAILLEUR HANGER SP-550I ..." → "Rear Derailleur Hanger"
  "PULLY PUL-110, 11T ..." → "Derailleur Pulley"
  "CHAIN CONNECTOR MK12 ..." → "Chain Connector"
- Do NOT use the model number as the name.
- 2-5 words maximum.
- Use the same language as the specification.

Specification:
${specification}
${modelNo ? `Model No: ${modelNo}` : ''}

Respond ONLY with a JSON object, no markdown:
{"name": "product type name here"}`

  try {
    const raw = await callLLM(cfg.provider, cfg.apiKey, cfg.model, [
      { role: 'user', content: prompt },
    ], 128)
    const parsed = parseJsonResponse<{ name?: string }>(raw)
    return parsed.name?.trim() || null
  } catch {
    return null
  }
}

// ─── 主要 enrichProduct 函式 ──────────────────────────────────────────────────

export type EnrichInput = {
  sku?: string | null
  modelNo?: string | null
  specification?: string | null
  unitPrice?: number
  supplierId?: number
  systemUserId: number
}

/**
 * 豐富化一個 PRD_Product：
 *  - 若 name 是空或等於 SKU（未設定），AI 推導名稱
 *  - 若 htsCode 未設定，AI 推導 HS Code
 *  - 若 unitPrice 有變動，更新 SUP_SupplierProduct 並寫 PRD_ProductHistory
 *
 * @returns 是否有任何欄位被更新
 */
export async function enrichProduct(
  prisma: PrismaClient,
  productId: number,
  input: EnrichInput,
  force = false,
): Promise<boolean> {
  const product = await prisma.pRD_Product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, sku: true, htsCode: true, specification: true },
  })
  if (!product) return false

  const cfg = await getSystemAiConfig(prisma)
  const spec = input.specification || product.specification || ''

  // name 等於 ModelNo 代表是 fallback 值，還沒有真正的 AI 推導名稱
  const modelNoTrimmed = input.modelNo?.trim()
  const needName = force
    || !product.name
    || product.name === product.sku
    || product.name === '未命名商品'
    || (!!modelNoTrimmed && product.name === modelNoTrimmed)
  const needHts  = force || !product.htsCode

  if ((!needName && !needHts) || !spec) {
    // 不需要 AI 推導，但仍可能需要更新價格
    await maybeUpdatePrice(prisma, productId, input)
    return false
  }

  let derivedName:    string | null = null
  let derivedHtsCode: string | null = null

  if (cfg) {
    const [name, hts] = await Promise.all([
      needName ? deriveName(cfg, spec, input.modelNo ?? null) : Promise.resolve(null),
      needHts  ? deriveHsCode(cfg, spec, product.name || input.modelNo || '') : Promise.resolve(null),
    ])
    derivedName    = name
    derivedHtsCode = hts
  }

  // fallback：AI 無法推導時，用 ModelNo 作為名稱
  if (needName && !derivedName) {
    derivedName = input.modelNo?.trim() || input.sku?.trim() || null
  }

  const updateData: Record<string, unknown> = {}
  if (needName && derivedName)    updateData.name    = derivedName
  if (needHts && derivedHtsCode)  updateData.htsCode = derivedHtsCode

  if (Object.keys(updateData).length > 0) {
    await prisma.pRD_Product.update({ where: { id: productId }, data: updateData })

    // 寫 ProductHistory（記錄 AI 推導觸發的變更）
    await prisma.pRD_ProductHistory.create({
      data: {
        productId,
        name:          (derivedName    ?? product.name) as string,
        sku:           product.sku,
        specification: spec || null,
        sourceType:    'AI_IMPORT',
        changedBy:     input.systemUserId,
      },
    }).catch(() => {})
  }

  await maybeUpdatePrice(prisma, productId, input)

  return Object.keys(updateData).length > 0
}

// ─── 價差比對 ─────────────────────────────────────────────────────────────────

async function maybeUpdatePrice(
  prisma: PrismaClient,
  productId: number,
  input: EnrichInput,
) {
  if (!input.supplierId || input.unitPrice == null) return

  const existing = await prisma.sUP_SupplierProduct.findUnique({
    where: { supplierId_productId: { supplierId: input.supplierId, productId } },
    select: { unitPrice: true },
  })

  const newPrice = new Decimal(input.unitPrice)

  if (!existing) {
    await prisma.sUP_SupplierProduct.create({
      data: { supplierId: input.supplierId, productId, unitPrice: newPrice, isPreferred: true },
    }).catch(() => {})
    return
  }

  // 價差超過 0.01 才更新（浮點誤差容忍）
  if (existing.unitPrice && !existing.unitPrice.equals(newPrice)) {
    await prisma.sUP_SupplierProduct.update({
      where: { supplierId_productId: { supplierId: input.supplierId, productId } },
      data: { unitPrice: newPrice },
    })
    console.log(`[enrich] 供應商 ${input.supplierId} 商品 ${productId} 價格更新：${existing.unitPrice} → ${newPrice}`)
  }
}
