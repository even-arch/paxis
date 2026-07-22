/**
 * 報關文件 AI 解析 — 出貨後從報關行/海關取得的文件（貨代發票、B/L、
 * 商業發票、出口報單…），一次呼叫同時判斷文件種類並解析結構化欄位。
 *
 * 純解析：這裡不寫任何業務資料表，只回傳結構化 JSON。
 * 「套用」動作（回填 HTS Code、建立費用項目）由呼叫端另外的 API 處理，
 * 且都需人工在畫面上按確認才會真的寫入。
 */

export type CustomsDocType =
  | 'FORWARDER_INVOICE'   // 貨代/報關行開的費用發票
  | 'BILL_OF_LADING'      // 提單（B/L）
  | 'COMMERCIAL_INVOICE'  // 商業發票
  | 'CUSTOMS_DECLARATION' // 海關出口報單
  | 'OTHER'

export interface ParsedFreightItem {
  name: string          // 費用名目，如「裝櫃費」「文件費」
  amountTWD: number
  note?: string
}

export interface ParsedCustomsLineItem {
  sku?: string | null
  orderNo?: string | null   // 對應的 PO/PI 號（報單上的 Order No.）
  htsCode?: string | null   // 完整稅則號別，如 8714.99.90.15-7
  declaredValueTWD?: number | null
  quantity?: number | null
  unit?: string | null
  bondedFactoryNote?: string | null // 保稅工廠相關備註（若有）
}

export interface ParsedCustomsDoc {
  docType: CustomsDocType
  docNo?: string | null          // 文件本身的編號（報單號、B/L 號、發票號）
  docDate?: string | null        // YYYY-MM-DD
  currency?: string | null
  totalAmount?: number | null    // 文件總金額（原幣別）
  totalAmountTWD?: number | null // 換算/申報的台幣金額（如報單的完稅價格）
  vesselVoyage?: string | null
  portOfLoading?: string | null
  portOfDischarge?: string | null
  cartons?: number | null
  grossWeightKg?: number | null

  // 貨代發票專屬：費用明細（供 Phase 3 建立 SLS_FobCostItem）
  freightItems?: ParsedFreightItem[]

  // 出口報單/商業發票專屬：逐項明細（供 Phase 3 回填 HTS Code、三方勾稽）
  lineItems?: ParsedCustomsLineItem[]

  // 保稅工廠合規備註（若文件中有提及不得退稅等限制）
  bondedFactoryWarning?: string | null

  summary?: string | null  // 一句話摘要，供列表快速瀏覽
}

const SYSTEM_PROMPT = `你是專業的國貿/報關文件解析助理。使用者會上傳出貨後從報關行或海關取得的文件，可能是以下四種之一：

1. FORWARDER_INVOICE（貨代/報關行費用發票）：列出裝櫃費、文件費、手續費、ENS、VGM 等費用項目
2. BILL_OF_LADING（提單 B/L）：船名航次、裝卸港、件數重量、Shipper/Consignee
3. COMMERCIAL_INVOICE（商業發票）：逐項品名、單價、金額，通常有 Order No. 對應
4. CUSTOMS_DECLARATION（海關出口報單）：逐項稅則號別（HTS Code）、完稅價格、可能有保稅工廠註記
5. OTHER：以上都不是

請先判斷這份文件屬於哪一種（docType），再依該種類解析對應欄位，回傳以下 JSON 格式：

{
  "docType": "FORWARDER_INVOICE | BILL_OF_LADING | COMMERCIAL_INVOICE | CUSTOMS_DECLARATION | OTHER",
  "docNo": "文件編號",
  "docDate": "YYYY-MM-DD",
  "currency": "幣別代碼，如 EUR/USD/TWD",
  "totalAmount": 數字或null,
  "totalAmountTWD": 數字或null,
  "vesselVoyage": "船名/航次",
  "portOfLoading": "裝貨港",
  "portOfDischarge": "卸貨港",
  "cartons": 箱數,
  "grossWeightKg": 毛重公斤數,
  "freightItems": [
    { "name": "費用名目", "amountTWD": 數字, "note": "備註" }
  ],
  "lineItems": [
    {
      "sku": "POINT NO. 或料號",
      "orderNo": "Order No.（對應的 PO/PI 號）",
      "htsCode": "完整稅則號別，如 8714.99.90.15-7",
      "declaredValueTWD": 數字,
      "quantity": 數字,
      "unit": "單位",
      "bondedFactoryNote": "若此項目提及保稅工廠供應/不得退稅，填寫原文重點；否則 null"
    }
  ],
  "bondedFactoryWarning": "若文件中任何地方提到保稅工廠、不得申請退稅等限制，整理成一句提醒；否則 null",
  "summary": "一句話摘要這份文件的重點（例：貨代費用發票，共 NT$5,477，含裝櫃費/文件費/ENS 等 6 項）"
}

注意：
- freightItems 只在 docType=FORWARDER_INVOICE 時填，其餘留空陣列
- lineItems 只在 docType=CUSTOMS_DECLARATION 或 COMMERCIAL_INVOICE 時填，其餘留空陣列
- 金額一律轉成數字（不含千分位逗號、幣別符號）
- 找不到的欄位填 null，不要猜測
- 只回傳 JSON，不加其他說明`

export function buildCustomsDocPrompt() {
  return { systemPrompt: SYSTEM_PROMPT, userPrompt: '請解析這份報關相關文件，回傳 JSON。' }
}

export const DOC_TYPE_LABEL: Record<CustomsDocType, string> = {
  FORWARDER_INVOICE: '貨代費用發票',
  BILL_OF_LADING: '提單（B/L）',
  COMMERCIAL_INVOICE: '商業發票',
  CUSTOMS_DECLARATION: '海關出口報單',
  OTHER: '其他文件',
}
