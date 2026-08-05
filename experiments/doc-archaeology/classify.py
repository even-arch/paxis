import os,re,json
T='/tmp/txt'
RULES=[
 ('PO_正本_我方發出',      lambda t: '正式訂單(' in t or '正式訂單（' in t),
 ('詢價單_我方發出',        lambda t: t.lstrip().startswith('詢價單')),
 ('PO_副本_客戶發來',       lambda t: 'Bestellung Nr' in t),
 ('PI_正本_我方發出',       lambda t: 'PROFORMA INVOICE' in t[:200]),
 ('CI_商業發票_我方發出',    lambda t: re.match(r'\s*INVOICE\s*\n\s*SOLD TO', t) is not None),
 ('PL_裝箱單_我方發出',      lambda t: re.match(r'\s*PACKING LIST', t) is not None),
 ('PL_供應商裝箱單_PDF',     lambda t: '包裝明細' in t[:120]),
 ('PL_供應商裝箱單_Excel',   lambda t: ('Kalloy Industrial' in t[:400] or '金享車業' in t[:400]) and 'Sheet' in t[:60]),
 ('出貨通知單_PAXIS',        lambda t: '出貨通知單' in t[:400] or 'Shipment Notice' in t[:400]),
 ('電子發票_台灣',          lambda t: '電子發票證明聯' in t[:200]),
 ('月度外銷內銷統計',        lambda t: '外銷＋內銷統計資料' in t[:300]),
 ('工廠進貨成本表',          lambda t: '工廠進貨成本' in t or ('台灣工廠' in t[:120] and '台灣合計' in t[:400])),
 ('銀行帳戶明細',           lambda t: any(k in t[:400] for k in ('彰銀甲存','上銀甲存','存款餘額','零用金','AA轉帳'))),
 ('貨代文件_驊慶',          lambda t: '驊慶運通' in t[:300] or '驊 慶 運 通' in t[:300]),
 ('報關_出口報單',          lambda t: 'AT/BC/' in t[:300] or '保稅廠產品出' in t[:200]),
 ('政府_稅費單據',          lambda t: any(k in t[:400] for k in ('營業稅','繳款書','繳稅結果','自來水事業處'))),
 ('CI_舊格式_IV+PK',       lambda t: 'COMMERCIAL INVOICE' in t[:300] and 'POINT ASIA CO., LTD.' in t[:120]),
 ('海運SO_DRAFT',          lambda t: t.lstrip().startswith('DRAFT') and 'POINT ASIA' in t[:200]),
 ('UPS_面單',              lambda t: 'about:blank' in t[:60]),
 ('銀行付款通知_德',         lambda t: 'Ausgabeprotokoll' in t[:200]),
 ('發票金額明細',           lambda t: re.search(r'YI-CHING\s+[\d.]+\s+H[ZV]\d+', t[:300]) is not None),
]
out={}
for fn in sorted(os.listdir(T)):
    t=open(os.path.join(T,fn)).read()
    fam='未分類'
    for name,fn_ in RULES:
        try:
            if fn_(t): fam=name; break
        except Exception: pass
    out[fn]=fam
json.dump(out,open('/tmp/work/families.json','w'),ensure_ascii=False,indent=1)
from collections import Counter
c=Counter(out.values())
print(f"{len(out)} 個有文字的檔  →  {len([k for k in c if k!='未分類'])} 個已辨識格式家族\n")
for k,v in c.most_common():
    print(f'  {v:>3}  {k}')
print('\n=== 未分類 ===')
for f,fam in out.items():
    if fam=='未分類': print('  ',f)
