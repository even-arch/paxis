// READ-ONLY 重載驗收：全刪→重新 load 後跑一次，檢查「出貨脊椎」是否乾淨對位。
// 用法：node scripts/verify-reload.mjs   （讀 .env 的 DATABASE_URL，只查詢、不寫入）
import { readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'

const DB = (() => {
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^DATABASE_URL\s*=\s*(.+)$/); if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  throw new Error('DATABASE_URL not found in .env')
})()
const sql = neon(DB)

// 1) 各文件筆數
const counts = await sql`SELECT "docType", count(*)::int AS n FROM "SYS_PatiscoSync" WHERE status='ok' GROUP BY "docType" ORDER BY "docType"`
console.log('=== 原始文件筆數（SYS_PatiscoSync）===')
for (const c of counts) console.log(`  ${c.docType.padEnd(8)} ${c.n}`)

// 2) 出貨脊椎：sourceOrderID → PI 命中率
const dos = await sql`SELECT "result" FROM "SYS_PatiscoSync" WHERE "docType"='DO' AND status='ok'`
const srcIds = new Set()
for (const d of dos) for (const doc of [d.result?.packingList, d.result?.commercialInvoice])
  if (doc) for (const p of (doc.packings ?? [])) if (p?.sourceOrderID) srcIds.add(String(p.sourceOrderID).trim())
const piDocIds = new Set((await sql`SELECT "patiscoDocId" FROM "PI"`).map(x => String(x.patiscoDocId)))
const hit = [...srcIds].filter(x => piDocIds.has(x)).length
console.log('\n=== 出貨脊椎（DO → PI，確定性）===')
console.log(`  出貨單 = ${dos.length}`)
console.log(`  sourceOrderID 種類 = ${srcIds.size}，exact 對到 PI = ${hit}/${srcIds.size}  ${hit === srcIds.size ? '✔ 全中' : '⚠ 有漏，檢查 step7 去重'}`)

// 3) 出貨單實際連到的 SLS_PI_Link 數（看有沒有孤兒出貨）
const slsLinks = await sql`SELECT s.id, count(l."piId")::int AS pis FROM "SLS" s LEFT JOIN "SLS_PI_Link" l ON l."shipmentId"=s.id GROUP BY s.id`
const orphanSls = slsLinks.filter(x => x.pis === 0).length
console.log(`  出貨(SLS)總數 = ${slsLinks.length}，其中沒連到任何 PI 的 = ${orphanSls}  ${orphanSls === 0 ? '✔' : '⚠ 有孤兒出貨'}`)

// 4) PI 有效(有出貨) vs 噪音(未出貨)
const piTotal = (await sql`SELECT count(*)::int AS n FROM "PI"`)[0].n
const piShipped = (await sql`SELECT count(DISTINCT l."piId")::int AS n FROM "SLS_PI_Link" l`)[0].n
console.log('\n=== PI 有效 vs 噪音 ===')
console.log(`  PI 總數 = ${piTotal}，有出貨(有效) = ${piShipped}，未出貨(待歸檔/在途) = ${piTotal - piShipped}`)

// 5) 供應商 PI（多為測試資料）連上 vs 留白
const supPi = (await sql`SELECT count(*)::int AS n FROM "PI_SupplierCopy"`)[0].n
console.log('\n=== 供應商 PI（PI_COPY，多為早期測試）===')
console.log(`  實際建立(品項唯一匹配才連) = ${supPi}  （其餘留白，不亂連）`)

console.log('\n(done, read-only)')
