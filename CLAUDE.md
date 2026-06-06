# PAXIS — Point Asia eXchange & Inventory System

## 專案概述

PAXIS 是錫諾系統**唯一用戶**的內部進銷存系統，單租戶設計，只服務我公司。

### PAXIS 在 Patisco 架構中的精確定位

Patisco 是一個三層角色的貿易平台（客戶 ↔ 我公司 ↔ 供應商），每一層之間以正副本文件流通。

**PAXIS 活在「我公司」這一格的內部，是 Patisco 正副本流向之間的倉庫帳本。**

它只關心一件事：**貨物進出我公司倉庫的那個動作，以及是誰在什麼時間按下確認。**

### 邊界原則（不可違反）

- PAXIS 不直接與客戶或供應商通訊（由 Patisco 或外部管道處理）
- PAXIS 不產生對外報價或訂單（那是 Patisco 的 `QUO_` / `ORD_`）
- Patisco 是三條資料輸入管道之一，不是唯一管道：
  - `PATISCO`：webhook 自動觸發
  - `MANUAL`：人工手填（文件不齊、不使用 Patisco 時的常態）
  - `AI_IMPORT`：上傳 PDF/Excel，AI 解析後人工確認

兩套系統透過 API（webhook）銜接，各自獨立運作，不共用資料庫。

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
