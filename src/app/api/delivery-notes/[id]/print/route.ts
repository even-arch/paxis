import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function fmtDate(d: Date | null | undefined) {
  if (!d) return ''
  const y = d.getFullYear() - 1911
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

const COPIES = [
  { label: '第一聯・存根', bg: '#f5f5f5', color: '#555', border: '#ccc' },
  { label: '第二聯・客戶', bg: '#ddf0ff', color: '#1a5f8a', border: '#9cd' },
  { label: '第三聯・司機', bg: '#ffd8d8', color: '#a33', border: '#e9a' },
]

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  if (isNaN(id)) return new NextResponse('Not found', { status: 404 })

  const dn = await prisma.sLS_DeliveryNote.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, shortName: true } },
      items: {
        include: { product: { select: { sku: true, name: true } } },
        orderBy: { id: 'asc' },
      },
    },
  })
  if (!dn) return new NextResponse('Not found', { status: 404 })

  // dn is now non-null; bind to a const so closures below see the narrowed type
  const doc = dn

  const totalQty     = doc.items.reduce((s, i) => s + i.quantity, 0)
  const totalCartons = doc.items.reduce((s, i) => s + (i.cartons ?? 0), 0)
  const totalWeight  = doc.items.reduce((s, i) => s + Number(i.grossWeightKg ?? 0), 0)

  const MAX_ROWS = 6
  const displayItems = doc.items.slice(0, MAX_ROWS)
  const blankRows = Math.max(0, MAX_ROWS - displayItems.length - 1)

  function itemRows() {
    const rows = displayItems.map((item, i) => `
      <tr>
        <td style="border:0.5px solid #ddd;padding:3px 4px;text-align:center">${String(i+1).padStart(2,'0')}</td>
        <td style="border:0.5px solid #ddd;padding:3px 4px">${item.product?.sku ?? ''}</td>
        <td style="border:0.5px solid #ddd;padding:3px 4px">${item.description ?? item.product?.name ?? ''}</td>
        <td style="border:0.5px solid #ddd;padding:3px 4px;text-align:right">${item.quantity}</td>
        <td style="border:0.5px solid #ddd;padding:3px 4px;text-align:center">${item.unit ?? ''}</td>
        <td style="border:0.5px solid #ddd;padding:3px 4px;text-align:right">${item.cartons ?? ''}</td>
        <td style="border:0.5px solid #ddd;padding:3px 4px;text-align:right">${item.grossWeightKg?.toString() ?? ''}</td>
      </tr>`)
    const blanks = Array.from({ length: blankRows }).map((_, i) => `
      <tr>
        <td style="border:0.5px solid #ddd;padding:3px 4px">&nbsp;</td>
        <td style="border:0.5px solid #ddd;padding:3px 4px">${i === 0 ? '<span style="color:#ccc;font-size:9px">以下空白</span>' : ''}</td>
        <td style="border:0.5px solid #ddd;padding:3px 4px">&nbsp;</td>
        <td style="border:0.5px solid #ddd;padding:3px 4px">&nbsp;</td>
        <td style="border:0.5px solid #ddd;padding:3px 4px">&nbsp;</td>
        <td style="border:0.5px solid #ddd;padding:3px 4px">&nbsp;</td>
        <td style="border:0.5px solid #ddd;padding:3px 4px">&nbsp;</td>
      </tr>`)
    return [...rows, ...blanks].join('')
  }

  function copy(c: typeof COPIES[0]) {
    return `
    <div style="width:100%;height:95mm;box-sizing:border-box;padding:6px 10px 5px;border-bottom:1px dashed #aaa;font-family:'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif;position:relative;font-size:11px;overflow:hidden;display:flex;flex-direction:column;">
      <span style="position:absolute;top:6px;right:6px;font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;background:${c.bg};color:${c.color};border:0.5px solid ${c.border}">${c.label}</span>

      <!-- Header -->
      <div style="display:flex;align-items:stretch;margin-bottom:4px">
        <div style="width:116px;border:0.5px solid #bbb;padding:4px 6px;display:flex;flex-direction:column;justify-content:center;flex-shrink:0">
          <span style="font-size:9px;color:#666">聯絡人</span>
          <span style="font-weight:700;color:#111;font-size:11px">${doc.contactName || '&nbsp;'}</span>
          <span style="font-size:9px;color:#666;margin-top:2px">電話</span>
          <span style="font-weight:700;color:#111;font-size:10px">${doc.contactPhone || '&nbsp;'}</span>
        </div>
        <div style="flex:1;text-align:center;display:flex;flex-direction:column;justify-content:center;padding:4px 8px">
          <div style="font-size:16px;font-weight:700;letter-spacing:1px;color:#111">錫諾系統股份有限公司</div>
          <div style="font-size:13px;font-weight:600;letter-spacing:5px;color:#333;margin-top:2px">銷&nbsp;&nbsp;貨&nbsp;&nbsp;單</div>
        </div>
        <div style="width:116px;flex-shrink:0"></div>
      </div>

      <!-- Info row -->
      <div style="display:flex;font-size:10px;border-top:0.5px solid #333;border-bottom:0.5px solid #333;padding:2px 0;margin-bottom:4px">
        ${[
          ['客戶代號', doc.customer?.shortName ?? '-'],
          ['客戶名稱', doc.customer?.name ?? '-'],
          ['出貨日期', fmtDate(doc.issueDate)],
          ['單據號碼', doc.docNo],
          ['對方單號', doc.counterpartNo ?? ''],
          ['頁次', '1 / 1'],
        ].map(([lbl, val]) => `
          <div style="flex:1;padding:0 4px;border-right:0.5px solid #ccc">
            <div style="font-size:8.5px;color:#666">${lbl}</div>
            <div style="font-weight:600;color:#111">${val}</div>
          </div>`).join('')}
      </div>

      <!-- Body: table + mark -->
      <div style="display:flex;align-items:stretch;margin-bottom:4px;flex:1;min-height:0">
        <div style="flex:1;min-width:0">
          <table style="width:100%;border-collapse:collapse;font-size:10.5px;height:100%">
            <thead>
              <tr>
                ${['序','品名規格','產品描述','數量','單位','箱數','重量(kg)'].map((h, hi) => `
                  <th style="background:#f5f5f5;border:0.5px solid #bbb;padding:3px 4px;text-align:${['數量','箱數','重量(kg)'].includes(h)?'right':'center'};font-weight:600;font-size:9.5px;color:#333;width:${[20,60,undefined,32,22,28,40][hi]??'auto'}px">${h}</th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${itemRows()}
              <tr style="background:#f9f9f9;font-weight:600">
                <td colspan="3" style="border:0.5px solid #bbb;border-top:0.5px solid #888;padding:3px 4px;text-align:right">數量合計</td>
                <td style="border:0.5px solid #bbb;border-top:0.5px solid #888;padding:3px 4px;text-align:right">${totalQty}</td>
                <td style="border:0.5px solid #bbb;border-top:0.5px solid #888;padding:3px 4px"></td>
                <td style="border:0.5px solid #bbb;border-top:0.5px solid #888;padding:3px 4px;text-align:right">${totalCartons || ''}</td>
                <td style="border:0.5px solid #bbb;border-top:0.5px solid #888;padding:3px 4px;text-align:right">${totalWeight > 0 ? totalWeight.toFixed(1) : ''}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Shipping mark -->
        <div style="width:140px;flex-shrink:0;border:0.5px solid #bbb;border-left:none;display:flex;flex-direction:column;padding:4px 6px">
          <div style="font-size:9px;color:#666;font-weight:600;border-bottom:0.5px solid #ddd;padding-bottom:2px;margin-bottom:4px">麥頭／備註</div>
          <div style="font-size:10px;color:#111;font-family:monospace;letter-spacing:0.3px;line-height:1.7;flex:1;white-space:pre-wrap">${(doc.shippingMark || doc.note || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>
      </div>

      <!-- Footer -->
      <div style="display:flex;font-size:10px">
        ${[
          { label: '送貨地址', val: doc.deliveryAddr ?? '', flex: 2 },
          { label: '貨運行',   val: doc.freightCo  ?? '', flex: 1 },
          { label: '車號',     val: doc.vehicleNo  ?? '', flex: 1 },
          { label: '預計送達', val: fmtDate(doc.deliveryDate), flex: 1 },
        ].map(f => `
          <div style="flex:${f.flex};border:0.5px solid #ccc;padding:3px 5px;min-height:22px">
            <span style="font-size:8.5px;color:#666;display:block;margin-bottom:1px">${f.label}</span>
            <span style="font-weight:600">${f.val}</span>
          </div>`).join('')}
      </div>

      <!-- Signatures -->
      <div style="display:flex;justify-content:space-between;margin-top:4px">
        ${['負責人','會計','製表'].map(s => `
          <div style="border-top:0.5px solid #888;padding-top:3px;width:80px;text-align:center;font-size:9px;color:#666">${s}</div>
        `).join('')}
        <div style="border-top:0.5px solid #888;padding-top:3px;width:130px;text-align:center;font-size:9px;color:#666">收貨簽收</div>
      </div>
    </div>`
  }

  // Remove the last copy's border-bottom
  const copies = COPIES.map((c, i) => {
    const html = copy(c)
    if (i === 2) return html.replace('border-bottom:1px dashed #aaa;', '')
    return html
  })

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${doc.docNo} — 銷貨單</title>
<style>
  @page { size: A4 portrait; margin: 5mm; }
  @media print { #toolbar { display: none !important; } body { margin: 0; background: #fff; } }
  body { background: #ddd; font-family: 'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif; margin: 0; }
  .sheet { width: 200mm; height: 287mm; background: #fff; margin: 0 auto; overflow: hidden; display: flex; flex-direction: column; }
</style>
</head>
<body>
<div id="toolbar" style="background:#444;padding:10px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10">
  <span style="color:#fff;font-size:14px">${doc.docNo} — 列印預覽</span>
  <button onclick="window.print()" style="margin-left:auto;background:#fff;border:none;border-radius:6px;padding:6px 18px;font-size:13px;cursor:pointer;font-weight:600">列印</button>
  <a href="/delivery-notes/${id}" style="color:#bbb;font-size:12px;text-decoration:none">← 返回</a>
</div>
<div class="sheet">
  ${copies.join('')}
</div>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
