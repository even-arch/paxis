# Archive（封存）系統

## 兩套欄位設計（不可混用）

### 產品（PRD_Product）— 雙欄位
```
isActive   Boolean  @default(true)
isArchived Boolean  @default(false)
```
- 活躍中：`isActive=true, isArchived=false`
- 已封存：`isActive=true, isArchived=true`（isActive 仍為 true！）
- 停用：`isActive=false`（不同概念）
- 查詢活躍產品：`WHERE isActive=true AND isArchived=false`
- 查詢封存產品：`WHERE isActive=true AND isArchived=true`

### 其他所有實體 — 單欄位 archivedAt
```
archivedAt DateTime?  // null = 活躍，非 null = 已封存
```
適用：`SUP_Supplier`、`CUS_Customer`、`PO`、`PI`、`SLS`
- 查詢活躍：`WHERE archivedAt = null`
- 查詢封存：`WHERE archivedAt IS NOT NULL`

## Cascade Archive（出貨單封存時）
封存 SLS（出貨單）時，`/api/shipments/archive` 會嘗試連帶封存：
1. 找出貨單連結的所有 PI（透過 `SLS_PI_Link`）
2. 對每張 PI：若 `SLS_Item.quantity 合計 >= PI_Item.quantity 合計`（完整出貨），封存該 PI
3. 對每張被封存的 PI：找對應的 PO（`PI.poOrders` 優先，fallback `poNo = piNo`）
4. 對每張 PO：若所有 `PO_Item.receivedQty >= PO_Item.quantity`（完整收貨），封存該 PO

部分出貨的 PI / 部分收貨的 PO 不會被連帶封存。

## Patisco Sync 的封存保護
sync 時若發現 `existing.archivedAt !== null`，直接 skip，不更新。update 資料時也不寫 `archivedAt: null`（已從 sync 邏輯中移除）。封存後的記錄不會被 sync 復原。

## AI 豐富化的封存保護
`/api/admin/re-enrich` 在 SQL 查詢中有 `WHERE "isActive" = true`，自動排除非活躍產品。但**注意**：封存產品（`isActive=true, isArchived=true`）會被包含在內——若要排除封存產品，需加上 `AND "isArchived" = false`。

## 已知地雷
- 不要對產品用 `archivedAt` 查詢，產品沒有這個欄位
- 不要對 PO/PI/SLS 用 `isArchived` 查詢，這些實體只有 `archivedAt`
- 庫存頁（inventory）需同時加 `isActive=true AND isArchived=false` 才能正確顯示 145 筆（而非 249）
