/**
 * 出貨通知單 A4 PDF（Email 附件用）
 *
 * 供應商沒有 PAXIS 帳號，Email 裡的頁面連結對他們無用，
 * 所以寄信時直接產出 A4 PDF 附上。
 * 中文字型（Noto Sans TC）放在 public/fonts/，由本站 URL 載入。
 */
import { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer'
import type { ShippingNoticeEmailData } from './mailer'

let fontsRegistered = false
function registerFonts() {
  if (fontsRegistered) return
  const base = process.env.NEXTAUTH_URL ?? 'https://paxis.tw'
  Font.register({
    family: 'NotoSansTC',
    fonts: [
      { src: `${base}/fonts/NotoSansTC-Regular.otf`, fontWeight: 'normal' },
      { src: `${base}/fonts/NotoSansTC-Bold.otf`, fontWeight: 'bold' },
    ],
  })
  // 中文不使用連字號斷行
  Font.registerHyphenationCallback(word => [word])
  fontsRegistered = true
}

const styles = StyleSheet.create({
  page: { fontFamily: 'NotoSansTC', fontSize: 9, padding: 40, color: '#1a1a1a' },
  companyName: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  title: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginVertical: 10 },
  infoRow: { flexDirection: 'row', marginBottom: 3 },
  infoLabel: { width: 70, color: '#555' },
  infoValue: { flex: 1 },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', marginBottom: 4, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: '#333' },
  table: { borderWidth: 1, borderColor: '#333', marginTop: 4 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#999' },
  trLast: { flexDirection: 'row' },
  th: { fontWeight: 'bold', backgroundColor: '#f0f0f0', padding: 4 },
  td: { padding: 4 },
  cPo: { width: '18%' }, cSku: { width: '18%' }, cName: { width: '38%' },
  cQty: { width: '14%', textAlign: 'right' }, cUnit: { width: '12%', textAlign: 'center' },
  marks: { borderWidth: 1, borderColor: '#333', padding: 8, marginTop: 4, fontSize: 8 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, textAlign: 'center', fontSize: 7, color: '#999' },
})

function SnDocument({ data }: { data: ShippingNoticeEmailData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.companyName}>{data.companyName}</Text>
        {data.companyEmail ? <Text style={{ color: '#555' }}>{data.companyEmail}</Text> : null}
        <Text style={styles.title}>出貨通知單 Shipping Notice</Text>

        <View style={styles.infoRow}><Text style={styles.infoLabel}>通知單號</Text><Text style={styles.infoValue}>{data.noticeNo}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>通知日期</Text><Text style={styles.infoValue}>{data.issueDate}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>供應商</Text><Text style={styles.infoValue}>{data.supplierName}{data.supplierContact ? `（${data.supplierContact}）` : ''}</Text></View>

        {(data.deliverToName || data.deliverToAddress || data.expectedDeliveryDate) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>交貨地點與期限（請將貨物出至以下地點）</Text>
            {data.deliverToName ? <View style={styles.infoRow}><Text style={styles.infoLabel}>收貨方</Text><Text style={styles.infoValue}>{data.deliverToName}</Text></View> : null}
            {data.deliverToAddress ? <View style={styles.infoRow}><Text style={styles.infoLabel}>地址</Text><Text style={styles.infoValue}>{data.deliverToAddress}</Text></View> : null}
            {data.deliverToContact ? <View style={styles.infoRow}><Text style={styles.infoLabel}>聯絡人</Text><Text style={styles.infoValue}>{data.deliverToContact}</Text></View> : null}
            {data.expectedDeliveryDate ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>期望到貨日</Text>
                <Text style={[styles.infoValue, { fontWeight: 'bold' }]}>{data.expectedDeliveryDate}（請務必於此日期前送達）</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>出貨品項</Text>
          <View style={styles.table}>
            <View style={styles.tr}>
              <Text style={[styles.th, styles.cPo]}>訂單號</Text>
              <Text style={[styles.th, styles.cSku]}>SKU</Text>
              <Text style={[styles.th, styles.cName]}>品名</Text>
              <Text style={[styles.th, styles.cQty]}>通知數量</Text>
              <Text style={[styles.th, styles.cUnit]}>單位</Text>
            </View>
            {data.items.map((item, i) => (
              <View key={i} style={i === data.items.length - 1 ? styles.trLast : styles.tr}>
                <Text style={[styles.td, styles.cPo]}>{item.poNo}</Text>
                <Text style={[styles.td, styles.cSku]}>{item.productSku ?? '—'}</Text>
                <Text style={[styles.td, styles.cName]}>{item.productName}</Text>
                <Text style={[styles.td, styles.cQty]}>{String(item.notifiedQuantity)}</Text>
                <Text style={[styles.td, styles.cUnit]}>{item.unit ?? 'PCS'}</Text>
              </View>
            ))}
          </View>
        </View>

        {data.shippingMarks ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>麥頭 Shipping Marks（請於出貨前核對）</Text>
            <Text style={styles.marks}>{data.shippingMarks}</Text>
          </View>
        ) : null}

        {data.note ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>備註</Text>
            <Text>{data.note}</Text>
          </View>
        ) : null}

        <Text style={styles.footer} fixed>{data.companyName} · PAXIS 系統產生 · {data.noticeNo}</Text>
      </Page>
    </Document>
  )
}

export async function renderShippingNoticePdf(data: ShippingNoticeEmailData): Promise<Buffer> {
  registerFonts()
  return Buffer.from(await renderToBuffer(<SnDocument data={data} />))
}
