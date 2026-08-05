# -*- coding: utf-8 -*-
import os,re,json
T='/tmp/txt'
fams=json.load(open('/tmp/work/families.json'))
def num(s):
    if s is None: return None
    s=str(s).replace(' ','').replace(' ','')
    if re.fullmatch(r'-?[\d.]+,\d{2}', s): s=s.replace('.','').replace(',','.')   # 德式 1.234,56
    else: s=s.replace(',','')
    try: return float(s)
    except: return None

def ex_po_zheng(t):                      # 正式訂單（我方 → 供應商）
    d={}
    m=re.search(r'正式訂單[（(]\s*([A-Z0-9]+)\s*[）)]',t); d['docNo']=m.group(1) if m else None
    m=re.search(r'賣家:\s*(.+?)\s+公司:\s*(.+)',t)
    if m: d['seller']=m.group(1).strip(); d['endCustomer']=m.group(2).strip()
    for k,pat in [('currency',r'交易幣別:\s*(\S+)'),('incoterm',r'交易條件:\s*(.+?)\s*$'),
                  ('orderDate',r'訂單日期:\s*([\d-]+)'),('deliveryDate',r'交貨日期:\s*([\d-]+)'),
                  ('destination',r'DESTINATION:\s*(.+?)\s*$'),('payment',r'付款方式:\s*(.+?)\s*$'),
                  ('shipVia',r'運送方式:\s*(.+?)\s*$'),('taxId',r'統一編號:\s*(\S+)')]:
        m=re.search(pat,t,re.M); d[k]=m.group(1).strip() if m else None
    m=re.search(r'訂單總金額\s*\(?([A-Z]{3})?\)?\s*([\d,\.]+)',t); d['total']=num(m.group(2)) if m else None

    items=[];cur=None
    lines=[l.rstrip() for l in t.split('\n')]
    for i,ln in enumerate(lines):
        s=ln.strip()
        m=re.match(r'^(?:(\d{3})\s+)?(\d{7,9})\s+(.*?)\s+(\d[\d,]*)\s+(?:([A-Z]{2,6})\s+)?([\d,\.]+)\s+([\d,\.]+)$',s)
        if m:
            unit=m.group(5)
            if not unit:
                for j in range(i+1,min(i+4,len(lines))):
                    mu=re.search(r'\b(CARD|PCS|PC|SET|SETS|CTN|KGS|PRS)\b',lines[j])
                    if mu: unit=mu.group(1); break
            cur={'sku':m.group(2),'desc':[m.group(3).strip()],'qty':num(m.group(4)),'unit':unit,
                 'unitPrice':num(m.group(6)),'amount':num(m.group(7))}; items.append(cur); continue
        if cur is not None and s and not re.match(r'^(Total|交貨日期|DESTINATION|付款方式|另增收費|總採購金額|訂單總金額|\d+\s*$)',s):
            if len(cur['desc'])<8: cur['desc'].append(s)

    for it in items:
        full='\n'.join(it['desc']); it['spec']=full
        m=re.search(r'HS ?Code[:：]\s*([\d.]+)',full); it['hsCode']=m.group(1) if m else None
        m=re.search(r'POINT ?NO[.,:]?\s*(\d+)',full); it['pointNo']=m.group(1) if m else None
        del it['desc']
    d['items']=items; return d

def ex_bestellung(t):                    # 客戶 PO（德文，副本）
    d={}
    m=re.search(r'Bestellung Nr\.?\s*([A-Z0-9]+)',t); d['docNo']=m.group(1) if m else None
    m=re.search(r'Bestelldatum\s*([\d.]+)',t); d['orderDate']=m.group(1) if m else None
    m=re.search(r'Sachbearbeiter\s+(.+)',t); d['contact']=m.group(1).strip() if m else None
    m=re.search(r'Bestellwarenwert\s+([\d.,]+)',t); d['total']=num(m.group(1)) if m else None
    d['buyer']='POINT-Helmig GmbH'; d['seller']='POINT Asia Co., Ltd.'
    items=[]
    for ln in t.split('\n'):
        m=re.match(r'^(\d{7,9})\s+(.*?)\s*(\d+)\s+(Stü|Stk|St)\s+([\d.,]+)\s+([\d.]+)\s+(.+?)\s*$',ln.strip())
        if m: items.append({'sku':m.group(1),'desc':m.group(2).strip(),'qty':num(m.group(3)),
                            'unit':m.group(4),'unitPrice':num(m.group(5)),'termin':m.group(6),'maker':m.group(7).strip()})
    d['items']=items; return d

def ex_pi(t):                            # PROFORMA INVOICE（我方 → 客戶）
    d={}
    for k,pat in [('docNo',r'ORDER NO:\s*(\S+)'),('date',r'DATE:\s*([\d-]+)'),('payment',r'PAYMENT:\s*(.+?)\s*$'),
                  ('incoterm',r'TERMS:\s*(.+?)\s*$'),('destination',r'DESTINATION:\s*(.+?)\s*$'),
                  ('shipOn',r'Shipping On:\s*([\d-]+)'),('buyer',r'SOLD TO:\s*(.+?)\s+ORDER NO')]:
        m=re.search(pat,t,re.M); d[k]=m.group(1).strip() if m else None
    m=re.search(r'Grand Total \(([A-Z]{3})\)\s*([\d,\.]+)',t)
    if m: d['currency']=m.group(1); d['grandTotal']=num(m.group(2))
    m=re.search(r'Order Amount\s+([\d,\.]+)',t); d['orderAmount']=num(m.group(1)) if m else None

    items=[];cur=None
    lines=[l.rstrip() for l in t.split('\n')]
    for i,ln in enumerate(lines):
        s=ln.strip()
        m=re.match(r'^(?:(\d{3})\s+)?(\d{6,9})\s+(.*?)\s+(\d[\d,]*)\s+(?:([A-Z]{2,4})\s+)?([\d,\.]+)\s+([\d,\.]+)$',s)
        if m:
            unit=m.group(5)
            if not unit:
                for j in range(i+1,min(i+4,len(lines))):
                    mu=re.search(r'\b(CARD|PCS|PC|SET|SETS|CTN|KGS|PRS)\b',lines[j])
                    if mu: unit=mu.group(1); break
            cur={'sku':m.group(2),'desc':[m.group(3).strip()],'qty':num(m.group(4)),'unit':unit,
                 'unitPrice':num(m.group(6)),'amount':num(m.group(7))}; items.append(cur); continue
        if cur is not None and s and not re.match(r'^(Total|Item Type|Amount|PLUS|Additional|Order Amount|Grand Total|SAY|\d+\s*$)',s):
            if len(cur['desc'])<10: cur['desc'].append(s)

    for it in items:
        full='\n'.join(it['desc']); it['spec']=full
        for k,p in [('pointNo',r'POINT ?NO[.,:]?\s*(\d+)'),('nw',r'N\.W\.\s*:\s*([\d.]+)'),
                    ('gw',r'G\.W\.\s*:\s*([\d.]+)'),('unitPerCarton',r'Unit ?/ ?Carton\s*:\s*(\d+)')]:
            m=re.search(p,full); it[k]=m.group(1) if m else None
        del it['desc']
    d['items']=items; return d

def ex_ci(t):                            # 商業發票
    d={};
    m=re.search(r'SOLD TO:\s*(.+?)\s+([AS]\d{6})',t)
    if m: d['buyer']=m.group(1).strip(); d['shipmentNo']=m.group(2)
    m=re.search(r'(\d{4}/\d{1,2}/\d{1,2})',t); d['date']=m.group(1) if m else None
    orders=re.findall(r'^\s*(E\d{7})\s*$',t,re.M); d['orderRefs']=sorted(set(orders))
    items=[];cur=None;curorder=None
    for ln in t.split('\n'):
        s=ln.strip()
        mo=re.match(r'^(E\d{7})$',s)
        if mo: curorder=mo.group(1); continue
        m=re.match(r'^(\d{3})\s+(.*?)\s+(\d[\d,]*)\s+([\d.]+)\s+([A-Z]{3})\s+([\d,\.]+)\s*$',s)
        if m:
            cur={'line':m.group(1),'desc':[m.group(2).strip()],'qty':num(m.group(3)),'unitPrice':num(m.group(4)),
                 'currency':m.group(5),'amount':num(m.group(6)),'orderRef':curorder}; items.append(cur); continue
        if cur is not None and s and not re.match(r'^(Total|TOTAL|SAY|Remark)',s):
            if len(cur['desc'])<12: cur['desc'].append(s)
    for it in items:
        full='\n'.join(it['desc']); it['spec']=full
        m=re.search(r'POINT ?NO[.,:]?\s*(\d+)',full); it['pointNo']=m.group(1) if m else None
        del it['desc']
    d['items']=items
    if items: d['currency']=items[0]['currency']
    return d

def ex_inq(t):                           # 詢價單
    d={}
    m=re.search(r'編號:\s*(\S+)',t); d['docNo']=m.group(1) if m else None
    m=re.search(r'訂單日期:\s*([\d-]+)',t); d['orderDate']=m.group(1) if m else None
    m=re.search(r'賣家:\s*(.+?)\s+交易幣別:\s*(\S+)',t)
    if m: d['seller']=m.group(1).strip(); d['currency']=m.group(2)
    m=re.search(r'交易條件:\s*(.+?)\s*$',t,re.M); d['incoterm']=m.group(1).strip() if m else None
    items=[]
    for ln in t.split('\n'):
        s=ln.strip()
        # 變體 A：No. SKU 規格 數量 單位 幣別 價格
        m=re.match(r'^(?:\d{3}\s+)?(\d{6,9})\s+(.*?)\s+(\d[\d,]*)\s+([A-Z]{2,4})\s+([A-Z]{3})\s+([\d,\.]+)$',s)
        if m:
            items.append({'sku':m.group(1),'desc':m.group(2).strip(),'qty':num(m.group(3)),
                          'unit':m.group(4),'currency':m.group(5),'unitPrice':num(m.group(6))}); continue
        # 變體 B：No. SKU 規格 數量 [單位]
        m=re.match(r'^(?:\d{3}\s+)?(\d{6,9})\s+(.*?)\s+(\d[\d,]*)(?:\s+([A-Z]{2,4}))?$',s)
        if m: items.append({'sku':m.group(1),'desc':m.group(2).strip(),'qty':num(m.group(3)),'unit':m.group(4)})
    d['items']=items; return d

def ex_sn(t):                            # PAXIS 出貨通知單
    d={}
    m=re.search(r'(SN-\d{8}-\d{4})',t); d['docNo']=m.group(1) if m else None
    m=re.search(r'To:\s*(.+)',t); d['supplier']=m.group(1).strip() if m else None
    return d

EXTRACTORS={'PO_正本_我方發出':ex_po_zheng,'PO_副本_客戶發來':ex_bestellung,'PI_正本_我方發出':ex_pi,
            'CI_商業發票_我方發出':ex_ci,'詢價單_我方發出':ex_inq,'出貨通知單_PAXIS':ex_sn}
REQ={'PO_正本_我方發出':['docNo','seller','currency','orderDate','total','items'],
     'PO_副本_客戶發來':['docNo','orderDate','total','items'],
     'PI_正本_我方發出':['docNo','date','incoterm','grandTotal','items'],
     'CI_商業發票_我方發出':['shipmentNo','date','orderRefs','items'],
     '詢價單_我方發出':['docNo','seller','currency','items'],
     '出貨通知單_PAXIS':['docNo','supplier']}

res={}; stats={}
for fn,fam in fams.items():
    if fam not in EXTRACTORS: continue
    t=open(os.path.join(T,fn)).read()
    try: d=EXTRACTORS[fam](t)
    except Exception as e: d={'_err':str(e)}
    d['_file']=fn; d['_family']=fam
    req=REQ[fam]; got=sum(1 for k in req if d.get(k) not in (None,[],''))
    d['_coverage']=round(got/len(req),3); d['_missing']=[k for k in req if d.get(k) in (None,[],'')]
    res.setdefault(fam,[]).append(d)

json.dump(res,open('/tmp/work/extracted.json','w'),ensure_ascii=False,indent=1)
print('=== 抽取覆蓋率（必要欄位）===')
tot=0;totf=0
for fam,rows in res.items():
    cov=sum(r['_coverage'] for r in rows)/len(rows)
    ni=sum(len(r.get('items',[])) for r in rows)
    tot+=sum(r['_coverage'] for r in rows); totf+=len(rows)
    print(f'  {fam:<22} {len(rows):>2} 檔  必要欄位 {cov*100:>5.1f}%   品項行 {ni}')
    for r in rows:
        if r['_missing']: print(f'        缺 {r["_missing"]}  ← {r["_file"][:70]}')
print(f'\n  加權平均覆蓋率 {tot/totf*100:.1f}%   共 {totf} 檔')
