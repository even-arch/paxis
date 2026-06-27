# 財務對帳系統（AP / AR）

## AP 應付帳款（`FIN_Payable`）
**觸發點**：出貨單確認時，呼叫 `calcAndUpsertPayables(prisma, shipmentId)`

### 計算邏輯
1. 按 `SLS_Item.piId` 分組（一張出貨單可能含多張 PI 的品項）
2. 每組找對應的 PO（優先用 `PI.poOrders`（slsPiId FK），找不到再用 `poNo = piNo` fallback）
3. 對每張 PO，按 SKU 匹配 `PO_Item.unitPrice`，加總算出應付金額（TWD）

### 分箱出貨保護
若同一張 PI 被多張出貨單引用（`SLS_PI_Link.count(piId) > 1`），`isPartialShipment = true`。分箱時**禁止 fallback 到 PO 全額**，只能用 item-level 單價計算，避免 double counting。

## AR 應收帳款（`FIN_Receivable`）
**觸發點**：出貨單確認時，呼叫 `calcAndUpsertReceivable(prisma, shipmentId)`

### 計算邏輯
- 直接從 `SLS_Item.unitPrice * quantity` 加總，得到外幣（通常 EUR）金額
- 轉 TWD：`amountTWD = amountForeign / ciExchangeRate`

### 匯率方向（重要）
`SLS.ciExchangeRate` 儲存的是 **TWD→EUR**（例如 0.02717），**不是** EUR→TWD。
- `rateAtInvoice`（EUR→TWD，例如 36.8）= `1 / ciExchangeRate`
- 切勿直接用 `ciExchangeRate` 乘以外幣金額

## 狀態機
```
FIN_Payable / FIN_Receivable:
  status = 0  未付款 / 未收款
  status = 1  部分付款 / 部分收款
  status = 2  全額付清 / 全額收款
```
已收款（`status > 0`）不允許 AR 自動覆寫（`calcAndUpsertReceivable` 遇到 status > 0 直接 skip）。

## 同批匯款（batchPayableId / batchReceivableId）
`FIN_Payable` 有 `batchPayableId`（自參照 FK），`FIN_Receivable` 有 `batchReceivableId`。
- 客戶或供應商一筆匯款同時涵蓋多張出貨單時使用
- 一張作為「主單」，其餘設 `batchPayableId = 主單.id`
- UI 在財務對帳頁顯示「同批：{shipmentNo}」

## 已知地雷
- `rateAtCollection`（實際收款時的匯率）與 `rateAtInvoice`（開立時的匯率）不同，匯差損益從這裡計算
- 修改收款（退回未收）的觸發條件是 `status >= 1`，不是 `status === 2`——只要有收款紀錄就能退回
