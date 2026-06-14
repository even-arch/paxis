# PAXIS 列印模板系統 — 工程師開發文件

> 版本：2026-06-14  
> 適用系統：PAXIS（Next.js 14 App Router + Prisma + PostgreSQL）  
> 本文件目的：讓工程師能夠理解並將此機制移植到 Patisco 正式版

---

## 一、系統概述

PAXIS 列印模板系統讓使用者能夠：

1. 使用**內建標準模板**直接列印文件（PI、PO、PL、CI）
2. 上傳既有表格的圖片或 PDF，透過 **AI Vision 分析版面**，自動生成 HTML 模板
3. 儲存多個**自訂模板**，在列印時選擇套用
4. 設定**每個客戶的自由欄位預設值**（裝載港、卸貨港、備註等）
5. 列印時即時填入**自由欄位**（不存回資料庫，僅影響本次列印）

### 設計原則

- **模板 = HTML 字串**：模板本身是純 HTML/CSS 字串，存在資料庫中
- **佔位符替換**：模板中用 `{{variable}}` 標記資料欄位，列印前由前端替換
- **不依賴後端渲染**：所有替換在瀏覽器端完成，列印頁面是純靜態 HTML
- **Print CSS 控制版面**：透過 `@media print` 隱藏 UI 元件，只印文件本體

---

## 二、資料庫 Schema

### PRN_Template（列印模板）

```sql
CREATE TABLE "PRN_Template" (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,          -- 模板名稱（如「標準 PI 格式」）
  docType     TEXT NOT NULL,          -- 文件類型：SLS_PI / PO_Order / SLS_PL / SLS_CI
  htmlBody    TEXT NOT NULL,          -- 完整 HTML 字串（含 style 屬性，不含 <html>/<body>）
  fieldMap    JSONB NOT NULL DEFAULT '{}',  -- 保留欄位（目前未使用）
  freeFields  JSONB NOT NULL DEFAULT '[]', -- 自由欄位定義清單（見下方格式）
  isDefault   BOOLEAN NOT NULL DEFAULT false,  -- 此 docType 的預設模板
  isSystem    BOOLEAN NOT NULL DEFAULT false,  -- 系統內建（不可刪除）
  createdAt   TIMESTAMP DEFAULT NOW(),
  updatedAt   TIMESTAMP NOT NULL
);
CREATE INDEX ON "PRN_Template"("docType");
```

**freeFields 格式：**
```json
[
  { "key": "portOfLoading",   "label": "Port of Loading",   "defaultValue": "" },
  { "key": "portOfDischarge", "label": "Port of Discharge", "defaultValue": "" },
  { "key": "countryOfOrigin", "label": "Country of Origin", "defaultValue": "" },
  { "key": "shippingMarks",   "label": "Shipping Marks",    "defaultValue": "" },
  { "key": "remarks",         "label": "Remarks",           "defaultValue": "" }
]
```

### PRN_CustomerDefault（每客戶自由欄位預設值）

```sql
CREATE TABLE "PRN_CustomerDefault" (
  id          SERIAL PRIMARY KEY,
  customerId  INTEGER NOT NULL REFERENCES "CUS_Customer"(id),
  docType     TEXT NOT NULL,      -- 與 PRN_Template.docType 相同
  freeFields  JSONB NOT NULL,     -- { "portOfLoading": "TWKHH", ... }
  updatedAt   TIMESTAMP NOT NULL,
  UNIQUE(customerId, docType)
);
CREATE INDEX ON "PRN_CustomerDefault"("customerId");
```

**支援的 docType 一覽：**

| docType   | 文件      | 來源資料表      |
|-----------|-----------|----------------|
| `SLS_PI`  | 形式發票  | SLS_PI         |
| `PO_Order`| 採購訂單  | PO_Order       |
| `SLS_PL`  | 裝箱單    | SLS_Shipment   |
| `SLS_CI`  | 商業發票  | SLS_Shipment   |

---

## 三、API 路由

### 3.1 模板管理

#### `GET /api/print/templates?docType=SLS_PI`
取得指定文件類型的模板清單（不含 htmlBody，用於下拉選單）。

**回傳：**
```json
[
  { "id": 1, "name": "標準 PI 格式", "docType": "SLS_PI", "isDefault": true, "isSystem": false, "freeFields": [...] },
  { "id": 2, "name": "客戶 A 專用", "docType": "SLS_PI", "isDefault": false, "isSystem": false, "freeFields": [...] }
]
```

#### `POST /api/print/templates`
建立新模板。

**Request Body：**
```json
{
  "name": "模板名稱",
  "docType": "SLS_PI",
  "htmlBody": "<div>...</div>",
  "freeFields": [...],
  "setAsDefault": false
}
```

#### `GET /api/print/templates/:id`
取得單一模板，**含 htmlBody**（在切換模板時使用）。

#### `PATCH /api/print/templates/:id`
更新模板（`setAsDefault: true` 或 `name: "新名稱"`）。

#### `DELETE /api/print/templates/:id`
刪除模板（`isSystem: true` 的模板不可刪除）。

---

### 3.2 客戶預設值

#### `GET /api/customers/:id/print-defaults?docType=SLS_PI`
取得某客戶某文件類型的自由欄位預設值。

**回傳：**
```json
{ "freeFields": { "portOfLoading": "TWKHH", "portOfDischarge": "NLRTM" } }
```
若不存在，回傳 `{ "freeFields": null }`。

#### `POST /api/customers/:id/print-defaults`
儲存（Upsert）預設值。

**Request Body：**
```json
{ "docType": "SLS_PI", "freeFields": { "portOfLoading": "TWKHH" } }
```

#### `DELETE /api/customers/print-defaults/:id`
刪除預設值記錄。

---

### 3.3 文件資料 API

每個文件類型都有獨立的資料 API，負責組合好所有列印所需欄位。

#### `GET /api/print/pi/:piId` → PI 列印資料
#### `GET /api/print/po/:poId` → PO 列印資料
#### `GET /api/print/shipment/:shipmentId` → 出貨文件（PL / CI 共用）

**PI 回傳結構範例：**
```json
{
  "pi":      { "piNo": "ABC-001", "piDate": "...", "tradeTerms": "FOB", ... },
  "order":   { "orderNo": "...", "customerPoNo": "...", "currencyCode": "USD", ... },
  "customer":{ "id": 1, "name": "...", "address": "...", ... },
  "company": { "nameEn": "...", "logoBase64": "data:image/png;base64,...", ... },
  "items":   [{ "productName": "...", "sku": "...", "quantity": 100, "unitPrice": 5.5, "amount": 550, ... }],
  "totals":  { "amount": 550, "cartons": 5, "grossWeightKg": 20.0, "cbm": 0.08, "currencyCode": "USD" }
}
```

> **注意**：`company.logoBase64` 是 Base64 編碼的圖片字串（`data:image/...;base64,...`），直接放入 `<img src="">` 即可，不依賴外部 URL，列印離線也能顯示。

---

### 3.4 AI 模板分析

#### `POST /api/ai/analyze-template`

接受圖片（PNG/JPG/WebP）或 PDF 檔案，透過 AI Vision 分析版面，回傳 HTML 模板草稿。

**Request：** `multipart/form-data`，欄位名 `file`

**Response：**
```json
{
  "templateName": "標準 PI 格式",
  "htmlBody": "<div style=\"font-family:Arial...\">...</div>",
  "freeFields": [
    { "key": "portOfLoading", "label": "Port of Loading", "defaultValue": "" }
  ],
  "analysisNote": "版面分析說明（繁體中文）"
}
```

**依賴：**
- `SYS_User.aiProvider`：`anthropic` 或 `openai`
- `SYS_User.encryptedAiKey`：AES-256-GCM 加密存放的 API Key
- `SYS_User.aiParseModel`：使用的模型（如 `claude-sonnet-4-6`、`gpt-4o`）
- PDF 轉圖片：使用 `mupdf` WASM 套件（`@/lib/ai-llm.ts` 中 `buildMessagesForFile()`）

---

## 四、前端實作

### 4.1 列印頁結構

每個文件類型都有獨立的列印頁，路徑格式：

```
/print/pi/[piId]
/print/po/[poId]
/print/pl/[shipmentId]
/print/ci/[shipmentId]
```

頁面結構（以 PI 為例）：

```
┌──────────────────────────────────────────────────────────┐
│ [操作列] ← 返回  [模板選單]  PI No.  [客戶名]  [列印按鈕]│  ← no-print
└──────────────────────────────────────────────────────────┘
┌──────────────────────────┬───────────────────────────────┐
│ [自由欄位側邊欄]          │  [文件預覽區]                  │  ← no-print
│  Port of Loading         │  ┌──────────────────────┐     │
│  Port of Discharge       │  │  A4 白紙預覽          │     │
│  Country of Origin       │  │  （210mm × 297mm）    │     │
│  Shipping Marks          │  │                      │     │
│  Remarks                 │  └──────────────────────┘     │
│  [儲存為預設值]           │                               │
└──────────────────────────┴───────────────────────────────┘

[列印輸出區]  ← print-only（@media screen 時 display:none）
```

### 4.2 模板替換引擎 `renderTemplate()`

```typescript
function renderTemplate(html: string, data: DocData, freeFields: FreeFields): string {
  // Step 1：替換品項重複區塊
  let result = html.replace(
    /\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/g,
    (_match, rowTpl: string) => {
      return items.map(item => {
        let row = rowTpl
        for (const [k, v] of Object.entries(itemVars(item))) {
          row = row.replaceAll(`{{${k}}}`, v)
        }
        return row
      }).join('')
    }
  )
  // Step 2：替換所有單值變數
  for (const [k, v] of Object.entries(vars)) {
    result = result.replaceAll(`{{${k}}}`, v)
  }
  return result
}
```

**特殊處理：`{{company.logo}}`**

```typescript
'company.logo': company?.logoBase64
  ? `<img src="${company.logoBase64}" style="max-height:60px;max-width:180px;object-fit:contain" alt="logo" />`
  : '',
```

### 4.3 模板選擇邏輯

```typescript
// 頁面載入時，自動選取 isDefault=true 的模板
useEffect(() => {
  fetch(`/api/print/templates?docType=SLS_PI`)
    .then(r => r.json())
    .then((list: TemplateOption[]) => {
      setTemplates(list)
      const def = list.find(t => t.isDefault)
      if (def) setSelectedTemplateId(def.id)  // 自動套用預設模板
    })
}, [])

// 切換模板時，fetch 完整 htmlBody
useEffect(() => {
  if (selectedTemplateId === 'builtin') {
    setCustomHtml(null)
    return
  }
  fetch(`/api/print/templates/${selectedTemplateId}`)
    .then(r => r.json())
    .then(t => setCustomHtml(t.htmlBody))
}, [selectedTemplateId])
```

### 4.4 Print CSS

```css
@media print {
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  .print-page { display: none !important; }  /* 預覽用外框不印出 */
  @page { size: A4; margin: 12mm 15mm; }
  body { font-size: 9pt; }
}

@media screen {
  .print-only { display: none !important; }
  .print-page {
    width: 210mm;
    min-height: 297mm;
    padding: 12mm 15mm;
    font-size: 9pt;
  }
}
```

**多頁表格表頭重複：**
```html
<thead style="display:table-header-group">
  <tr>...</tr>
</thead>
```

**防止行被分頁切斷：**
```html
<tr style="page-break-inside:avoid">...</tr>
```

---

## 五、模板佔位符一覽

### 5.1 通用變數（所有文件類型）

| 佔位符 | 說明 |
|--------|------|
| `{{company.logo}}` | 公司 Logo（自動轉成 `<img>` 標籤） |
| `{{company.nameEn}}` | 公司英文名 |
| `{{company.nameZh}}` | 公司中文名 |
| `{{company.addressEn}}` | 公司地址 |
| `{{company.phone}}` | 電話 |
| `{{company.fax}}` | 傳真 |
| `{{company.email}}` | Email |
| `{{company.taxId}}` | 統一編號 |
| `{{company.bankName}}` | 銀行名稱 |
| `{{company.bankAccount}}` | 銀行帳號 |
| `{{company.bankSwift}}` | SWIFT Code |

### 5.2 PI（SLS_PI）專用

| 佔位符 | 說明 |
|--------|------|
| `{{customer.name}}` | 客戶名稱 |
| `{{customer.address}}` | 客戶地址 |
| `{{customer.contactPerson}}` | 客戶聯絡人 |
| `{{pi.piNo}}` | PI 號碼 |
| `{{pi.piDate}}` | PI 日期 |
| `{{pi.estimatedShipDate}}` | 預計出貨日 |
| `{{pi.tradeTerms}}` | 交易條件 |
| `{{order.orderNo}}` | 訂單號 |
| `{{order.customerPoNo}}` | 客戶 PO 號 |
| `{{order.currencyCode}}` | 幣別 |
| `{{order.paymentTerms}}` | 付款條件 |
| `{{totals.amount}}` | 總金額（含幣別） |
| `{{totals.cartons}}` | 總箱數 |
| `{{totals.grossWeightKg}}` | 總毛重（kg） |
| `{{totals.cbm}}` | 總材積（CBM） |
| `{{#items}}...{{/items}}` | 品項重複區塊 |
| `{{item.productName}}` | 品名 |
| `{{item.sku}}` | SKU |
| `{{item.modelNo}}` | 型號 |
| `{{item.specification}}` | 規格 |
| `{{item.unit}}` | 單位 |
| `{{item.quantity}}` | 數量 |
| `{{item.unitPrice}}` | 單價（含幣別） |
| `{{item.amount}}` | 小計（含幣別） |

### 5.3 PO（PO_Order）專用

| 佔位符 | 說明 |
|--------|------|
| `{{supplier.name}}` | 供應商名稱 |
| `{{supplier.address}}` | 供應商地址 |
| `{{supplier.contactPerson}}` | 供應商聯絡人 |
| `{{po.poNo}}` | PO 號碼 |
| `{{po.orderDate}}` | PO 日期 |
| `{{po.expectedDate}}` | 預計到貨日 |
| `{{po.tradeTerms}}` | 交易條件 |
| `{{po.currencyCode}}` | 幣別 |
| `{{po.paymentTerms}}` | 付款條件 |
| `{{totals.amount}}` | 總金額 |
| `{{#items}}...{{/items}}` | 品項重複區塊 |
| `{{item.productName}}` / `{{item.sku}}` / `{{item.quantity}}` / `{{item.unitPrice}}` / `{{item.amount}}` | 同 PI |

### 5.4 PL（裝箱單 Packing List）

PL 與 CI 都基於 `SLS_Shipment` 資料。

| 佔位符 | 說明 |
|--------|------|
| `{{customer.name}}` | 客戶名稱 |
| `{{shipment.shipmentNo}}` | 出貨單號 |
| `{{shipment.packingListNo}}` | 裝箱單號 |
| `{{shipment.actualShipDate}}` | 實際出貨日 |
| `{{shipment.portOfLoading}}` | 裝載港 |
| `{{shipment.portOfDischarge}}` | 卸貨港 |
| `{{shipment.trackingNo}}` | 追蹤號 / B/L No. |
| `{{totals.cartons}}` | 總箱數 |
| `{{totals.grossWeightKg}}` | 總毛重 |
| `{{totals.netWeightKg}}` | 總淨重 |
| `{{totals.cbm}}` | 總材積（CBM） |
| `{{#items}}...{{/items}}` | 品項重複區塊 |
| `{{item.productName}}` / `{{item.sku}}` | 同上 |
| `{{item.quantity}}` | 數量 |
| `{{item.cartons}}` | 箱數 |
| `{{item.cartonNoFrom}}` - `{{item.cartonNoTo}}` | 箱號範圍 |
| `{{item.grossWeightKg}}` | 毛重（kg） |
| `{{item.netWeightKg}}` | 淨重（kg） |
| `{{item.cbm}}` | 材積（CBM） |

### 5.5 CI（商業發票 Commercial Invoice）

CI 使用與 PL 相同的 shipment 資料，但額外帶金額：

| 佔位符 | 說明 |
|--------|------|
| `{{shipment.commercialInvNo}}` | CI 發票號 |
| `{{shipment.currencyCode}}` | 幣別 |
| `{{item.unitPrice}}` | 單價 |
| `{{item.amount}}` | 小計 |
| `{{totals.amount}}` | 總金額 |
| （其餘與 PL 相同） | — |

### 5.6 自由欄位（所有文件類型）

| 佔位符 | 說明 |
|--------|------|
| `{{free.portOfLoading}}` | 裝載港（手動填入） |
| `{{free.portOfDischarge}}` | 卸貨港 |
| `{{free.countryOfOrigin}}` | 原產地 |
| `{{free.shippingMarks}}` | 麥頭 |
| `{{free.remarks}}` | 備註 |

> 自由欄位的值在每次列印時由使用者填入，不存回資料庫（除非點「儲存為預設值」）。

---

## 六、AI 模板生成

### 流程

```
使用者上傳圖片/PDF
      ↓
/api/ai/analyze-template（POST）
      ↓
buildMessagesForFile()   ← 處理 PDF 轉圖片（mupdf WASM）
      ↓
callLLM()                ← 呼叫 Anthropic / OpenAI API
      ↓
AI 分析版面 + 生成 HTML 字串
      ↓
回傳 { templateName, htmlBody, freeFields, analysisNote }
      ↓
前端顯示預覽（iframe）
      ↓
使用者確認 → POST /api/print/templates 儲存
```

### System Prompt 設計原則

AI Prompt 分為三個部分：

1. **角色定義**：告知 AI 任務（分析文件版面、生成 HTML/CSS 模板）
2. **可用欄位清單**：列出所有 `{{variable}}` 佔位符及其說明
3. **視覺還原規則**（重要）：
   - 底色/背景色必須用 `background-color` 還原
   - 框線粗細、顏色、單邊/四邊都要還原
   - 間距（行高、padding）參考原始比例
   - 色塊區域（如深色表頭）必須還原
   - 「寧可多猜顏色，也不要輸出白底黑字表格」

4. **輸出格式**：強制 JSON，禁止 markdown 包裹

### AI 基礎設施（`src/lib/ai-llm.ts`）

```typescript
// 統一的 LLM 呼叫介面（支援 Anthropic / OpenAI）
callLLM(provider, apiKey, model, messages, maxTokens): Promise<string>

// 將檔案（圖片或 PDF）轉成 LLM messages 格式
// PDF 會用 mupdf WASM 轉成圖片頁面
buildMessagesForFile(buffer, mimeType, filename, systemPrompt, userPrompt, provider): Promise<Message[]>
```

---

## 七、模板管理 UI

路徑：`/settings/templates`

**Tab 1「列印模板」：**
- AI 上傳區域（拖放或點選，接受 PNG/JPG/WebP/PDF）
- 上傳後顯示分析結果審閱面板：
  - iframe 預覽（立即可見效果）
  - 切換查看 HTML 原始碼
  - 填寫模板名稱 + 是否設為預設
  - 儲存按鈕

**Tab 2「客戶預設值」：**
- 列出所有已設定的客戶預設值
- 展開查看自由欄位內容
- 可刪除

---

## 八、文件各頁的列印入口

每個文件詳情頁都有「列印」按鈕，開新分頁跳到列印頁：

```tsx
// PI 列印按鈕（在 SalesPIPanel.tsx 中）
<a href={`/print/pi/${pi.id}`} target="_blank" rel="noopener noreferrer"
  className="text-xs bg-gray-100 text-gray-700 border border-gray-300 px-2 py-0.5 rounded hover:bg-gray-200">
  🖨 列印
</a>

// PO 列印按鈕（在採購單詳情頁中）
<a href={`/print/po/${po.id}`} target="_blank" ...>🖨 列印 PO</a>

// PL / CI 列印按鈕（在出貨單詳情頁中）
<a href={`/print/pl/${shipment.id}`} target="_blank" ...>🖨 裝箱單</a>
<a href={`/print/ci/${shipment.id}`} target="_blank" ...>🖨 商業發票</a>
```

---

## 九、移植到 Patisco 的步驟

### 前置條件

1. 資料庫中建立 `PRN_Template` 和 `PRN_CustomerDefault` 兩張表（見第二節 Schema）
2. 公司資料表中要有 `logoBase64` 欄位（或等效的 Logo 存放機制）
3. 用戶資料表中要有 `aiProvider`、`encryptedAiKey`、`aiParseModel` 欄位
4. 後端要有 AES-256-GCM 加解密工具（對應 `src/lib/crypto.ts`）
5. PDF 轉圖片需安裝 `mupdf` WASM（`npm install mupdf`）

### 複製的核心檔案

| PAXIS 路徑 | 說明 |
|-----------|------|
| `src/lib/ai-llm.ts` | AI 呼叫基礎設施（含 PDF 轉圖） |
| `src/lib/crypto.ts` | API Key 加解密 |
| `src/app/api/ai/analyze-template/route.ts` | AI 分析 API（含 System Prompt） |
| `src/app/api/print/templates/route.ts` | 模板 CRUD API |
| `src/app/api/print/templates/[id]/route.ts` | 單一模板 API |
| `src/app/api/customers/[id]/print-defaults/route.ts` | 客戶預設值 API |
| `src/app/print/pi/[piId]/page.tsx` | PI 列印頁（含 renderTemplate 函式） |
| `src/app/(main)/settings/templates/TemplatesClient.tsx` | 模板管理 UI |

### 需要客製化的部分

1. **資料 API**：`/api/print/pi/:id` 等需要對應 Patisco 的資料結構重寫
2. **renderTemplate() 的 vars 對應**：確保佔位符與 Patisco 欄位名稱對應
3. **docType 命名**：可沿用或自訂，只要保持一致
4. **AI Prompt 中的欄位清單**：更新為 Patisco 的佔位符清單

---

## 十、安全注意事項

- `dangerouslySetInnerHTML`：列印頁使用此方式插入模板 HTML，模板來源是自家資料庫，不接受外部輸入，風險可控
- AI API Key 必須加密存放（AES-256-GCM），不可明文存入資料庫
- 模板 API 需要登入驗證（`getServerSession`），所有 API 都應加 auth guard
- 列印頁雖為 client component，但資料 API 需驗證 session

---

*文件結束。如有疑問請聯絡 Even（even@xinosys.com）。*
