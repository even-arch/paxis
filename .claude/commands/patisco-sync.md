# PAXIS × Patisco 同步系統

## 兩階段架構

### Phase 1 — 拉取原始資料
- 從 Patisco API 抓所有文件，存入 `SYS_PatiscoSync` 快取表（不寫業務表）
- **增量邏輯**：每份文件有 `patiscoModifiedAt`（Patisco 的 `LastModifiedDate`）。若 `patiscoModifiedAt <= existingModifiedAt`，直接跳過，不重新抓取
- **已知地雷**：Patisco 修改文件內容（例如改單號、新增品項）有時不更新 `modifiedAt`，導致 Phase 1 跳過，快取永遠是舊的。解法：從 DB 刪除那筆 `SYS_PatiscoSync` 記錄，下次 sync Phase 1 視為新記錄重新抓取

### Phase 2 — 解析寫入業務表
- 讀 `SYS_PatiscoSync`（快取），不呼叫 Patisco API
- **執行順序不可亂**，有 FK 相依：
  1. 客戶主檔（CUS_Customer）← 從 PO_COPY 的 buyer
  2. 供應商主檔（SUP_Supplier）← 從 PI_COPY 的 seller
  3. 產品主檔（PRD_Product）← 所有文件的 SKU
  4. 銷售訂單（PO_CustomerCopy）← 從 PO_COPY
  5. 採購訂單（PO）← 從 PO，嘗試連結 PO_CustomerCopy
  6. 供應商 PI（PI_SupplierCopy）← 從 PI_COPY，連結 PO
  7. 我方 PI（PI）← 從 PI，連結 PO_CustomerCopy
  8. 出貨單（SLS）← 從 DO，只連 PI，不連 PO

## isSelf() 過濾
Phase 2 每一步都用 `isSelf(header.seller?.name)` 判斷文件是否屬於我方公司。關鍵字從 `SYS_Company` 動態載入，fallback 到空陣列（等於全部跳過）。若 sync 結果 created/updated 都是 0，先確認 `SYS_Company` 是否設定了正確的公司關鍵字。

## 封存保護（重要）
sync 不會復原已封存的記錄：
- 若 `existing.archivedAt !== null`，直接 skip，不更新
- Update 時也不寫 `archivedAt: null`（已移除）

## 衝突偵測（已移除）
舊版有 Phase 2 PI sync 的衝突偵測（相同 piNo 在 SYS_PatiscoSync 出現兩筆 → 兩者都跳過）。這個邏輯**已移除**。現在相同 piNo 的多筆記錄，後面的會覆寫前面的（last write wins）。`PIConflict` / `PIConflictRecord` 型別和 `DuplicatePIModal` 元件保留但永遠不會觸發。

## SYS_PatiscoSync 表結構
```
docType          // 'PO_COPY' | 'PO' | 'PI_COPY' | 'PI' | 'DO'
patiscoDocId     // Patisco 內部 UID（唯一鍵）
patiscoDocNo     // 文件號碼（可重複，e.g. E2520113）
patiscoModifiedAt // Patisco LastModifiedDate
result           // JSON，存完整 API response
syncedAt         // 我們最後一次抓取的時間
```
unique key 是 `(docType, patiscoDocId)`，同一份文件的更新用 upsert 覆蓋。

## 已知地雷
- **modifiedAt 不更新**：改單號、新增品項、改 PI 狀態，Patisco 有時不更新 `modifiedAt`。強制重新抓：刪除對應 `SYS_PatiscoSync` 記錄後重新 sync
- **DO packing 項目在 `packings` 不在 `orders.items`**：`packingList.orders[].items` 永遠是空的，實際品項在 `packingList.packings[]`（直接的 SKU 陣列）
- **PI 出貨進度**：`SLS_Item.piId` 必須正確設定才會計入出貨進度計算。若 SLS_Item 沒有 piId，`SLS_PI_Link` 有連結也無濟於事
