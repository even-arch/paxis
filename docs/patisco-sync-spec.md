# PAXIS × Patisco 資料同步邏輯說明

> 建立日期：2026-06-19
> 適用版本：sync.ts（Phase 1 + Phase 2 逐步模式）

---

## 一、整體架構：兩階段同步

同步分兩個獨立階段，分開執行以避免逾時。

```
Phase 1：拉資料   →   SYS_PatiscoSync（原始快取）
Phase 2：解析資料 →   各業務資料表
```

**Phase 1** 負責向 Patisco API 逐一拉取文件內容，存入 `SYS_PatiscoSync` 當作原始快取。這一層做得越薄越好，只存、不解析。支援增量更新（跳過未異動的記錄）。

**Phase 2** 從 `SYS_PatiscoSync` 讀出所有快取，解析後寫入業務資料表。Phase 2 拆成 8 個步驟，每個步驟獨立發出一次 API 請求，避免 Vercel 300 秒逾時限制。

---

## 二、Patisco 的五種文件類型

Patisco 是三方角色的貿易平台：**客戶 ↔ 我公司 ↔ 供應商**。我公司在每張單據中可能是「發文方」或「收文方」，判定方式如下：

| Patisco 文件 | 我公司位置 | 類型 | PAXIS 對應表 |
|---|---|---|---|
| **PI** | Seller（發文方） | 正本：我發給客戶的 PI | `SLS_Order` + `SLS_PI` |
| **PO** | Buyer（收文方） | 正本：我下給供應商的訂單 | `PO_Order` |
| **PO_COPY** | Seller（副本） | 客戶的 PO 副本寄給我 | `SLS_Order`（補充） |
| **PI_COPY** | Buyer（副本） | 供應商的 PI 副本寄給我 | `PO_SupplierPI` |
| **DO** | Shipper（出貨方） | 出貨文件（PL + CI） | `SLS_Shipment` |

判定「我公司」的方式：比對 seller/buyer 欄位名稱是否包含 `SYS_Company` 裡設定的公司名稱關鍵字（英文名、中文名、簡稱）。

---

## 三、Phase 2 八個步驟詳解

### Step 1：客戶主檔（`CUS_Customer`）

**來源：** PI 的 `header.buyer`（完整聯絡資訊）＋ PO_COPY 的 `buyerName`（補充）

**邏輯：**
- 從 PI 讀 buyer 的名稱、地址、城市、國家、電話、Email、傳真、統編，以及幣別（`header.currencyCode`）
- 以客戶名稱去重；同名只建一筆
- PO_COPY 裡出現的 buyerName，若不在 PI 名單中則補建（僅有名稱，無詳細資料）
- 幣別從 Patisco 內部編號轉成 ISO 代碼（43=TWD、44=USD、15=EUR、21=JPY）

---

### Step 2：供應商主檔（`SUP_Supplier`）

**來源：** PO 的 `header.seller`（完整聯絡資訊）＋ PI_COPY 的 `sellerName`（補充）

**邏輯：** 鏡像 Step 1，但角色換成供應商（PO 裡的 seller）。預設幣別為 TWD（台灣廠商）。

---

### Step 3：產品主檔（`PRD_Product`）

**來源：** 所有文件類型的 `products[]` 陣列（PI、PO、PO_COPY、PI_COPY）

**邏輯：**
- **SKU 是唯一識別碼**，只要 SKU 相同就視為同一產品
- 若 SKU 為空則略過（Patisco 有些品項沒有填 SKU）
- 初次建立時，若找不到正式商品名稱（name 欄位為 modelNo 或 sku 本身），標記 `nameNeedsAI=true`，等待後續 AI 補名
- 已存在的產品不覆蓋（保留手動維護的資料）

---

### Step 4：客戶訂單（`SLS_Order`）— 來自 PO_COPY

**來源：** `PO_COPY`（客戶的 PO 副本）

**邏輯：**
- PO_COPY 存的是 `{ sellerName, buyerName, products[] }` 格式，沒有完整 header
- 以文件號碼（`patiscoDocNo`）作為 `orderNo`
- 幣別在這裡先填 USD 作為佔位；等 Step 7 同名 PI 出現後會回補正確幣別
- 同時建立 `SLS_Item`（品項）

> PO_COPY 通常只有少量記錄，大多數 SLS_Order 由 Step 7 建立。

---

### Step 5：採購訂單（`PO_Order`）

**來源：** `PO`（我方下給供應商的訂單）

**邏輯：**
- 確認 `header.buyer` 是我方（`isSelf()` 比對）才處理
- `header.seller` 是供應商，查找對應 `SUP_Supplier`
- 嘗試用 PO 號碼找對應的 `SLS_Order`（客戶訂單）：若存在則建立關聯（`salesOrderId`）
- 幣別從 `header.currencyCode` 轉換

---

### Step 6：供應商 PI（`PO_SupplierPI`）

**來源：** `PI_COPY`（供應商的 PI 副本）

**邏輯：**
- PI_COPY 格式為 `{ sellerName, buyerName }`
- `sellerName` 對應供應商，查找 `SUP_Supplier.id`
- 嘗試用單號找對應的 `PO_Order`

---

### Step 7：我方 PI（`SLS_PI`）— 最核心的步驟

**來源：** `PI`（我方發給客戶的 PI）

**邏輯（每張 PI 依序執行）：**

1. 確認 `header.seller` 是我方才處理
2. **每張 PI 對應一筆獨立的 `SLS_Order`**——以 PI 號碼作為訂單號碼查找
   - 若 SLS_Order 已存在（Step 4 先建了）：更新幣別、客戶、日期
   - 若不存在：新建一筆 SLS_Order
3. 建立 `SLS_Item`（品項）：遍歷 PI 的 `products[]`，以 SKU 查找 `PRD_Product`，建立明細
4. 建立 `SLS_PI` 記錄，欄位包括：
   - `piNo`：PI 號碼
   - `piDate`：文件上的發行日期
   - `estimatedShipDate`：PI 的到期/預計出貨日（`header.expiredDate`）
   - `currencyCode`：從 `header.currencyCode` 轉換
5. 建立 `SLS_PIItem`：將 PI 品項連結到 SLS_Item

**注意：** `header.payment` 是貿易條件（FOB/FOR），不是幣別。幣別欄位是 `header.currencyCode`。

**效能優化：** 步驟開始前預載四個 Map（PRD_Product、CUS_Customer、SLS_Order、SLS_PI），將迴圈內的 DB 查詢從每筆 ~40 次降至 ~5 次，整體從 240 秒降至約 60 秒。

---

### Step 8：出貨文件（`SLS_Shipment`）

**來源：** `DO`（Delivery Order），每筆包含 `packingList` 和 `commercialInvoice`

**邏輯：**
- 一張出貨文件可包含**多張 PI**（`packingList.orders[]` 陣列）
- DO 裡的 PI 號碼有時含額外說明文字（如 "E2520244 KY"），取第一個空格前的部分來比對 `SLS_PI.piNo`
- 建立 `SLS_Shipment` 記錄（`shipmentNo`、客戶、出貨日）
- 建立 `SLS_ShipmentPI`（一對多：一張出貨單連多張 PI）
- 建立 `SLS_ShipmentItem`（出貨品項，帶箱號、重量、材積）

**業務含義：** 客戶可能分批出貨——同一張 PI 的 300 個產品，可能這次只出 100 個，剩下 200 個出現在下一張出貨文件裡。這個拆分邏輯由 Patisco 處理，PAXIS 只負責對應並記錄。

---

## 四、重要規則備忘

| 規則 | 說明 |
|---|---|
| SKU 唯一性 | 產品比對只能用 SKU，不可用品名 fuzzy match |
| 幣別欄位 | `header.currencyCode` 是幣別；`header.payment` 是貿易條件（FOB/FOR），兩者不同 |
| 每張 PI 獨立建單 | 一張 PI = 一筆 SLS_Order，不跨 PI 合併到同一訂單 |
| 單號原則 | 外部給的號碼一律不修改，空白才由系統生成內部流水號 |
| 公司判定 | 靠 `SYS_Company` 設定的關鍵字，不寫死在程式碼裡 |
| DO 的 PI 號 | 取空格前的部分對應，容許後綴說明文字（如客戶備註） |
| Phase 2 逐步執行 | 每次 API 呼叫只跑一個 step，進度記錄在 `SYS_SyncJob.phase2Step` |
