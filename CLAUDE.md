# PAXIS — Point Asia eXchange & Inventory System

## 專案概述

PAXIS 是錫諾系統**唯一用戶**的內部進銷存系統，單租戶設計，只服務我公司。

### PAXIS 在 Patisco 架構中的精確定位

Patisco 是一個三層角色的貿易平台（客戶 ↔ 我公司 ↔ 供應商），每一層之間以正副本文件流通。

**PAXIS 活在「我公司」這一格的內部，是 Patisco 正副本流向之間的倉庫帳本。**

它只關心一件事：**貨物進出我公司倉庫的那個動作，以及是誰在什麼時間按下確認。**

### 正副本判定規則（不可違反）

**判定依據：看「我公司」在單據中的位置**

```
我公司 = 發件方（Seller / Issuer）  →  正本（我們主動發出的）
我公司 = 收件方（Buyer / Recipient） →  副本（別人發給我們的）
```

| 文件 | 我公司位置 | 正/副 | PAXIS 對應 |
|------|-----------|-------|-----------|
| 客戶下訂單給我們 | Seller（收單方） | **副PO** | `SLS_Order` |
| 我們開 PI 給客戶 | Issuer | **正PI** | `SLS_PI` |
| 我們下單給供應商 | Buyer | **正PO** | `PO_Order` |
| 供應商開 PI 給我們 | Recipient | **副PI** | `PO_SupplierPI` |
| 出貨文件 | Shipper | **Shipping Doc** | `SLS_Shipment` + `PO_Receipt` |

**應用**：解析文件時，只要比對 Seller/Buyer 欄位與我公司名稱，即可自動路由到正確的 PAXIS 記錄類型，不需要使用者手動指定文件種類。

**Patisco MCP 匯入範圍**：只匯入上述五類文件。客戶、供應商、產品的主檔資料，一律從文件內容比對衍生，不獨立匯入。

### 邊界原則（不可違反）

- PAXIS 不直接與客戶或供應商通訊（由 Patisco 或外部管道處理）
- PAXIS 不產生對外報價或訂單（那是 Patisco 的 `QUO_` / `ORD_`）
- Patisco 是三條資料輸入管道之一，不是唯一管道：
  - `PATISCO`：webhook 自動觸發
  - `MANUAL`：人工手填（文件不齊、不使用 Patisco 時的常態）
  - `AI_IMPORT`：上傳 PDF/Excel，AI 解析後人工確認

兩套系統透過 API（webhook）銜接，各自獨立運作，不共用資料庫。

---

## 核心定位原則

### PRD_Product 是「交易帳本裡的 SKU 識別碼」，不是商品目錄

- **目的**：追蹤這個 SKU 買了幾次、賣了幾次、現在庫存多少、成本多少
- **不做的事**：對客戶展示商品頁、維護行銷文案、管理產品照片（那是 Patisco 的職責）
- 從 Patisco 拉下來的 SKU，進 PAXIS 的唯一目的是**讓採購單和銷售單能對到同一條紀錄**

### 單據號碼一致性原則（不可違反）

無論從哪個管道進來（手動、AI 掃描、Patisco MCP），**外部給的單號一律不得由系統修改、截斷、或加任何後綴**。

這些號碼是對外溝通的最終依據：向供應商對產品、向客戶對訂單、向報關行對資料，中間過程絕對不能更動。

```
客戶 PO 號   →  SLS_Order.orderNo      （沿用客戶自己的號碼，原封不動）
供應商 PI 號 →  PO_SupplierPI.piNo     （供應商自定，保留原值）
我方 PI 號   →  SLS_PI.piNo            （需引用 SLS_Order.orderNo，讓客戶可以對應）
採購單號     →  PO_Order.poNo          （沿用原始文件號；空白時才由系統生成內部流水號）
```

**系統生成號碼的規則：**
- 僅在外部沒有給號碼時才啟用（`docRefNo` 或 `orderNo` 為空）
- 系統生成的是**內部識別碼**（格式：`PO-YYYYMMDD-XXXX`、`SLS-YYYYMMDD-XXXX`），不對外使用
- 若一張客戶訂單需要拆給多個供應商，採購單號由使用者手動輸入各自的號碼，系統不自動加 `-1/-2/-3` 後綴

單號是整條交易鏈的索引，編號一致才能勾稽。

### PAXIS 的核心工作：比對差異，不只是存單據

單據存檔是基礎，但真正的價值在三個比對檢查點：

| 檢查點 | 比對內容 | 意義 |
|--------|---------|------|
| A：採購確認 | PO_Order vs PO_SupplierPI | 供應商有沒有改數量/改價格？ |
| B：毛利確認 | PO_Order（買價）vs SLS_PI（賣價）| 每個 SKU 的毛利是否被壓縮？ |
| C：出貨確認 | SLS_PI vs SLS_Shipment | 實際出的貨與 PI 開的是否一致？ |

---

## 完整文件流程圖

### 採購側（我公司向供應商進貨）

```
節點 1：PO_Order（我發出訂單正本）
         庫存不動
            ↓
節點 2：PO_SupplierPI（收到供應商 PI 副本）
         預期入庫，確認供應商預計出貨日
         庫存不動
            ↓
節點 3：PO_Receipt（收到裝箱單 / 直接按「入庫」）
         ★ quantity++
         寫 INV_Movement type=1
```

**重要**：quantity++ 發生在節點 3（裝箱單/入庫確認），**不是**節點 2（PI 副本）。

### 銷售側（客戶向我公司下單）

```
節點 1：SLS_Order（收到客戶訂單）
         庫存不動
            ↓
節點 2：SLS_PI（我發出 PI 正本給客戶）
         ★ reservedQty++
         寫 INV_Movement type=2
            ↓
節點 3：SLS_Shipment（發出裝箱單 / 直接按「出貨」）
         ★ quantity--, reservedQty--
         寫 INV_Movement type=4
```

### 三條資料輸入管道

每個節點都支援三種來源，最終寫入相同的資料結構：

```
Patisco webhook  ─────┐
手動表單填寫     ──────┼──→  同一份 DB record（source 欄位記錄來源）
AI 匯入（PDF/Excel）──┘
```

---

## 交易鏈（Transaction Chain）

### 一對一：單一供應商

```
SLS_Order (orderNo: "ABC-001")
  └─ PO_Order (poNo: "ABC-001", salesOrderId → SLS_Order.id)
       └─ PO_SupplierPI
       └─ PO_Receipt → quantity++
  └─ SLS_PI (piNo: "ABC-001")
       └─ SLS_Shipment → quantity--
```

### 一對多：客戶單拆給多個供應商

```
SLS_Order (orderNo: "ABC-001")
  ├─ PO_Order (poNo: "ABC-001-1", salesOrderId → SLS_Order.id)  ← 供應商 A
  ├─ PO_Order (poNo: "ABC-001-2", salesOrderId → SLS_Order.id)  ← 供應商 B
  └─ PO_Order (poNo: "ABC-001-3", salesOrderId → SLS_Order.id)  ← 供應商 C
       ↓（三張 PO 全部確認到貨後）
  └─ SLS_PI (piNo: "ABC-001")  ← 一張 PI 合併發給客戶
```

**拆單邏輯**：依 `SUP_SupplierProduct`（產品→供應商 mapping）自動分組。Patisco 端已先拆好，PAXIS 接收時對應到同一個 `SLS_Order`。

### 多對一：多張客戶單從庫存出貨

```
SLS_Order A ─┐
SLS_Order B ─┼─→ 從 INV_Stock 各自扣減（無需連結同一個 PO_Order）
SLS_Order C ─┘
```

**`salesOrderId` 欄位規則**：
- `PO_Order.sourceType = 1`（接單後採購）→ `salesOrderId` 必填
- `PO_Order.sourceType = 0`（主動補貨/安全庫存）→ `salesOrderId` 為 null

---

## 最小必要資料集

任何管道（手動、AI 掃描、Patisco MCP）進來的單據，**都必須滿足以下最小集合**，否則系統標記為「不完整」：

| 欄位 | 採購側 | 銷售側 |
|------|-------|-------|
| 單號 | `PO_Order.poNo` | `SLS_Order.orderNo` |
| 日期 | `PO_Order.createdAt` | `SLS_Order.createdAt` |
| 交易對象 | `supplierId` | `customerId` |
| 品項（SKU + 數量 + 單價）| `PO_Item[]` | `SLS_Item[]` |
| 出貨資料（出貨時必填）| `PO_Receipt` 箱數/毛重 | `SLS_Shipment` + `SLS_ShipmentItem` |

---

## 庫存兩階段模型

### 三個數字

```
quantity     = 實際庫存（倉庫裡真正有的）
reservedQty  = 預留量（已發 PI 正本、尚未出倉）
availableQty = quantity - reservedQty  ← 前端顯示，防超賣，不存 DB
```

### INV_Movement 類型對照

| type | 觸發事件 | 來源 table | 庫存變化 |
|------|---------|-----------|---------|
| 1 | 採購入庫確認 | `PO_Receipt` | quantity++ |
| 2 | 我發出 PI 正本 | `SLS_PI` | reservedQty++ |
| 3 | PI 正本取消 | `SLS_PI` 作廢 | reservedQty-- |
| 4 | 出貨確認 | `SLS_Shipment` | quantity--, reservedQty-- |
| 5 | 手動調整入 | — | quantity++ |
| 6 | 手動調整出 | — | quantity-- |
| 7 | 盤點調整 | — | 依差異 |
| 8 | POS 銷售出庫 | — | quantity--（預留給 POS 對接） |
| 9 | POS 退貨入庫 | — | quantity++（預留給 POS 對接） |

### INV_Movement 是唯一真相來源

所有庫存變動都必須透過 `INV_Movement` 寫入，不得直接更新 `INV_Stock`。

---

## 操作稽核原則（不可妥協）

文件可以缺，但**「誰按的、什麼時間按的」絕對不能缺**。

每個產生庫存變動的動作（`PO_Receipt`、`SLS_PI`、`SLS_Shipment`）都必須記錄：

| 欄位 | 說明 | 規則 |
|------|------|------|
| `performedBy` | 操作者 userId | Patisco 自動觸發時為 null，手動時必填 |
| `performedAt` | 操作時間 | Server timestamp，`@default(now())`，不接受 client 傳入 |
| `source` | 觸發來源 | `PATISCO` / `MANUAL` / `AI_IMPORT` |
| `patiscoDocId` | Patisco 文件 ID | 選填，source=PATISCO 時必填 |

---

## 出貨時間追蹤

不同節點的出貨時間有不同精確度：

| 節點 | 欄位 | 性質 |
|------|------|------|
| `SLS_Order.customerRequestedShipDate` | 客戶希望出貨日 | 期望值，可能為 null |
| `SLS_PI.estimatedShipDate` | PI 上標註的預計出貨日 | 估算值，通常會填 |
| `SLS_Shipment.actualShipDate` | 實際離港日 | **確定值，最終出倉日期** |

後續追蹤功能：從 `SLS_PI.estimatedShipDate` 計算倒數天數，提醒處理人員準備出貨文件。

---

## Table 前綴命名

| 前綴 | 模組 |
|------|------|
| `PRD_` | 商品（Product） |
| `SUP_` | 供應商（Supplier） |
| `CUS_` | 客戶（Customer） |
| `PO_` | 採購單（Purchase Order） |
| `SLS_` | 銷售單（Sales） |
| `INV_` | 庫存（Inventory） |
| `COST_` | 成本（Cost） |
| `SYS_` | 系統設定 |

---

## 技術架構

| 層級 | 技術 |
|------|------|
| 框架 | Next.js 14+ (App Router, TypeScript) |
| ORM | Prisma |
| 資料庫 | PostgreSQL（Vercel Postgres） |
| 樣式 | Tailwind CSS |
| 認證 | NextAuth.js |

### 設計原則
- **單租戶**：PAXIS 只服務錫諾系統一家公司，不需要 TenantID
- **獨立資料庫**：與 Patisco 完全隔離，schema 乾淨
- **可獨立運作**：即使 Patisco 不在線，PAXIS 依然正常運作
- **可選整合**：Patisco webhook 是輸入管道之一，失敗不影響主流程

---

## 核心模組

### 1. 商品管理 (`PRD_`)
商品主檔，為所有模組的基礎。SKU、規格、包裝、HTS 編碼、原產地。

### 2. 供應商管理 (`SUP_`)
供應商主檔、聯絡人、供應商-商品對應關係（一品多供應商）。

### 3. 客戶管理 (`CUS_`)
客戶主檔，PAXIS 內部使用。Patisco 的買家資料透過 webhook 帶入，人工關聯到此主檔。

### 4. 採購管理 (`PO_`)
PO_Order → PO_SupplierPI → PO_Receipt 三節點。AI 匯入入口在 `/import`。

### 5. 銷售管理 (`SLS_`)
SLS_Order → SLS_PI → SLS_Shipment 三節點。支援 Patisco webhook 自動建立。

### 6. 庫存管理 (`INV_`)
INV_Stock（當前庫存）+ INV_Movement（所有異動紀錄，唯一真相來源）。

### 7. 成本計算 (`COST_`)
FOB → Landed Cost 完整成本鏈，含關稅、運費、保險、代理費等。ET61 K-MART/WAL-MART 範本。

---

## Patisco Webhook 介接

Patisco → PAXIS 的四個事件：

| 事件 | PAXIS 動作 |
|------|-----------|
| `order.confirmed` | 建立 `SLS_Order`（source=PATISCO） |
| `pi.issued` | 建立 `SLS_PI` → reservedQty++ |
| `pi.cancelled` | `SLS_PI` 作廢 → reservedQty-- |
| `shipment.confirmed` | 建立 `SLS_Shipment` → quantity--, reservedQty-- |

Webhook endpoint：`POST /api/webhooks/patisco`
規格文件：`docs/patisco-webhook-spec.md`
驗證：HMAC-SHA256，secret 存於 `SYS_PatiscoConfig.webhookSecret`

---

## 環境變數（`.env`）

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"
WEBHOOK_SECRET_KEY="用於 AES-256-GCM 加密儲存的主密鑰"
```

---

## 開發順序建議

1. `prisma/schema.prisma` ✅ 已完成
2. Migration：`npx prisma migrate dev`
3. 商品模組（其他模組依賴它）
4. 供應商模組
5. 採購模組（PO_Order + PO_SupplierPI + PO_Receipt）
6. 客戶模組
7. 銷售模組（SLS_Order + SLS_PI + SLS_Shipment）
8. 庫存模組（INV_Movement 查帳頁）
9. 成本計算
10. Patisco Webhook 介接（最後做，不影響主流程）

---

## ET61 參考

ET61 是錫諾系統過去使用的 Windows 進銷存系統（1990年代，Btrieve 資料庫）。成本計算模組的主要欄位參考：

`FOB_PRICE`、`DUTY_RATE`、`FREIGHT`、`INSURANCE`、`AGENT_FEE`、`LANDED_COST`、`SELLING_PRICE`、`GROSS_PCT`、`INNER`、`OUTER`、`CUBE`、`GW`、`NW`、`TSUSA`
