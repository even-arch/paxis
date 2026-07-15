/**
 * 麥頭（Shipping Marks）供應商篩選。
 *
 * SLS.shippingMarks 是 Patisco DO「其它資訊」原文，由多個以空行分隔的
 * Remark 區塊組成，每個區塊對應一個 PI 號與箱號範圍；「-DO-」（ditto）
 * 子區塊沿用前一個 Remark 的版型，只換單號與箱號。
 *
 * 篩選單位：從「Remark」起頭到下一個「Remark」之前（含跟在後面的 -DO-
 * 子區塊）視為一個單元。單元內只要出現該供應商相關的單號，整個單元保留。
 */

/** 從單號字串中抽出基礎文件號（如 "E2620018-1" → "E2620018"） */
export function extractBaseDocNo(str: string): string {
  const m = str.match(/\b([A-Z]{1,3}\d{5,})\b/)
  return m ? m[1] : str.split(/[\s-]/)[0]
}

/** 以空行切塊，再把 Remark 起頭的塊與其後續（-DO- 等）合併成單元 */
function splitMarkUnits(marks: string): string[] {
  const blocks = marks.split(/\r?\n\s*\r?\n/).map(b => b.trim()).filter(Boolean)
  if (blocks.length === 0) return []

  const units: string[] = []
  let current: string[] = []
  for (const block of blocks) {
    if (/^remark\b/i.test(block) && current.length > 0) {
      units.push(current.join('\n\n'))
      current = []
    }
    current.push(block)
  }
  if (current.length > 0) units.push(current.join('\n\n'))
  return units
}

/**
 * 依供應商相關單號篩選麥頭。
 * @param marks    麥頭原文
 * @param docNos   該供應商相關的單號（PO 號、PI 號皆可，自動取基礎號比對）
 * @returns        篩選後的麥頭；若解析不出任何單元或完全無匹配，回傳原文（寧多勿漏）
 */
export function filterMarksForDocNos(marks: string, docNos: string[]): string {
  const bases = Array.from(new Set(docNos.map(extractBaseDocNo).filter(Boolean)))
  if (bases.length === 0) return marks

  const units = splitMarkUnits(marks)
  if (units.length === 0) return marks

  const matched = units.filter(u => bases.some(b => u.includes(b)))

  // 完全沒匹配到（單號寫法對不上）→ 保留原文，寧可多給也不漏
  if (matched.length === 0) return marks
  return matched.join('\n\n')
}

/**
 * 找出「在麥頭中找不到對應區塊」的單號，用於畫面警告。
 * 常見原因：麥頭原文打錯字（如 E26200046 vs E2620046），
 * 精確比對對不上，該區塊會被 filterMarksForDocNos 濾掉而默默消失。
 * @param marks    麥頭原文
 * @param docNos   要檢查的單號（通常傳 PO 號，警告時使用者才認得）
 * @returns        沒有任何麥頭單元包含其基礎號的單號
 */
export function findUnmatchedDocNos(marks: string, docNos: string[]): string[] {
  const units = splitMarkUnits(marks)
  if (units.length === 0) return []
  return docNos.filter(docNo => {
    const base = extractBaseDocNo(docNo)
    return !units.some(u => u.includes(base))
  })
}
