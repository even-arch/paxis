# PAXIS — Point Asia eXchange & Inventory System

## 專案概述

PAXIS 是錫諾系統內部使用的進銷存系統，設計為與 Patisco（Point Asia Trading Information System Cooperation）平行運作的配套工具。

- **Patisco** 負責對外：B2B 型錄、買家下單、出貨追蹤、數位貿易
- **PAXIS** 負責對內：供應商管理、進貨採購、庫存控管、成本計算

兩套系統透過 API（webhook / REST）銜接，各自獨立運作，不共用資料庫。

---

## 技術架構

| 層級 | 技術 |
|------|------|
| 框架 | Next.js 14+ (App Router, TypeScript) |
| ORM | Prisma |
| 資料庫 | MySQL 8.0 |
| 樣式 | Tailwind CSS |
| 認證 | NextAuth.js |

### 設計原則
- **單租戶**：PAXIS 只服務錫諾系統一家公司，不需要 TenantID
- **獨立資料庫**：與 Patisco 完全隔離，schema 乾淨
- **可獨立運作**：即使 Patisco 不在線，PAXIS 依然正常運作
- **可選整合**：透過 `src/api/patisco/` 模組與 Patisco 銜接，銜接失敗不影響主流程

---

## 核心模組

### 1. 商品管理 (`src/modules/product/`)
管理公司的商品主檔，為其他模組的基礎。

**主要功能：**
- 商品 CRUD（名稱、SKU、型號、規格、包裝）
- 包裝規格：內箱數量、外箱數量、CBM、毛重、淨重
- HTS 海關編碼、原產地
- 商品圖片管理
- 與 Patisco 的 `PRD_Product` 同步（選用）

### 2. 供應商管理 (`src/modules/supplier/`)
管理上游供應商資料。

**主要功能：**
- 供應商主檔（公司名、地址、聯絡人、付款條件）
- 供應商與商品的對應關係（一個商品可有多個供應商）
- 供應商報價紀錄

### 3. 進貨管理 (`src/modules/purchase/`)
向供應商下採購訂單，觸發庫存增加。

**主要功能：**
- 採購單（PO）建立、追蹤
- 採購明細（商品、數量、單價、幣別）
- 入庫確認 → 自動更新庫存
- 採購狀態：草稿 → 已送出 → 部分到貨 → 完成

### 4. 庫存管理 (`src/modules/inventory/`)
即時庫存數量追蹤。

**主要功能：**
- 每個商品的現有庫存量
- 庫存異動紀錄（進貨 / 出貨 / 調整）
- 安全庫存預警
- 與 Patisco 訂單確認連動扣減（選用）

### 5. 成本計算 (`src/modules/cost/`)
ET61 最核心的功能，計算從 FOB 到 Landed Cost 的完整成本鏈。

**主要功能：**
- FOB 成本輸入（供應商報價）
- 到岸成本計算：運費 + 關稅（HTS 稅率）+ 代理費 + 保險 + 其他
- 毛利率計算（Landed Cost → 售價 → Gross %）
- 出口報價單產出（對應 ET61 的 K-MART / WAL-MART 範本）
- 多幣別支援（匯率設定）

---

## Patisco 介接（`src/api/patisco/`）

### 介接原則
- 所有 Patisco 呼叫都集中在 `src/api/patisco/` 目錄
- 呼叫失敗必須 graceful degrade，不能讓主流程出錯
- 使用環境變數 `PATISCO_API_URL` 和 `PATISCO_API_KEY`

### 主要介接點

| 方向 | 觸發時機 | 動作 |
|------|---------|------|
| PAXIS → Patisco | 新增/更新商品 | Push 到 Patisco PRD_Product |
| Patisco → PAXIS | 訂單確認 webhook | 扣減庫存 |
| PAXIS → Patisco | 庫存低於安全值 | 通知（選用）|

### Patisco API 文件
參考 `docs/patisco-schema.sql` 了解 Patisco 的資料結構。

---

## 命名規則

### 資料庫 Table（Prisma Model）
參考 Patisco 的前綴命名規則：

| 前綴 | 模組 |
|------|------|
| `PRD_` | 商品（Product） |
| `SUP_` | 供應商（Supplier） |
| `PO_` | 採購單（Purchase Order） |
| `INV_` | 庫存（Inventory） |
| `COST_` | 成本（Cost） |
| `SYS_` | 系統設定 |

### 檔案命名
- React 元件：PascalCase（`SupplierForm.tsx`）
- API Route：kebab-case（`/api/suppliers/[id]`）
- 工具函式：camelCase（`calcLandedCost.ts`）
- Prisma Model：PascalCase，對應 Table 前綴（`SupplierMaster`）

---

## 資料夾結構

```
paxis/
├── CLAUDE.md                    ← 你正在看這個
├── docs/
│   └── patisco-schema.sql       ← Patisco 資料庫 schema 參考
├── prisma/
│   └── schema.prisma            ← PAXIS 資料庫 schema
├── src/
│   ├── app/                     ← Next.js App Router 頁面
│   ├── lib/                     ← 共用工具（db, auth, utils）
│   ├── api/
│   │   └── patisco/             ← Patisco 介接模組
│   └── modules/
│       ├── product/             ← 商品管理
│       ├── supplier/            ← 供應商管理
│       ├── purchase/            ← 進貨管理
│       ├── inventory/           ← 庫存管理
│       └── cost/                ← 成本計算
└── package.json
```

---

## 環境變數（`.env`）

```env
DATABASE_URL="mysql://user:password@localhost:3306/paxis"
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"

# Patisco 介接（選用）
PATISCO_API_URL="https://api.patisco.com"
PATISCO_API_KEY="your-api-key"
PATISCO_WEBHOOK_SECRET="your-webhook-secret"
```

---

## ET61 參考

ET61 是錫諾系統過去使用的 Windows 進銷存系統（1990年代，Btrieve 資料庫）。PAXIS 的成本計算模組以 ET61 的 K-MART / WAL-MART 報價範本為設計參考，主要欄位包括：

- `QUO_NO`、`ITEM_NO`、`SUP_NO`
- `FOB_PRICE`、`DUTY_RATE`、`FREIGHT`、`INSURANCE`、`AGENT_FEE`
- `LANDED_COST`、`SELLING_PRICE`、`GROSS_PCT`
- 包裝：`INNER`、`OUTER`、`CUBE`、`UNIT_WT`、`GW`、`NW`
- HTS：`TSUSA`、`DUTY_KG`

---

## 開發順序建議

1. `prisma/schema.prisma` — 先把所有 model 定義好
2. `src/lib/db.ts` — Prisma client 單例
3. `src/modules/product/` — 商品模組（其他模組都依賴它）
4. `src/modules/supplier/` — 供應商模組
5. `src/modules/purchase/` — 進貨模組
6. `src/modules/inventory/` — 庫存模組
7. `src/modules/cost/` — 成本計算（最複雜）
8. `src/api/patisco/` — Patisco 介接（最後做，不影響主流程）
